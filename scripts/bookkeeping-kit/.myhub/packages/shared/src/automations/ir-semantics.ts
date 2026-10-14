/**
 * Flow IR semantic validation — stage 1b of the validation pipeline
 * (architecture/technical/automations.md §10).
 *
 * The Zod schema (ir-schema.ts) guarantees shape; this module guarantees the
 * graph makes sense:
 *   - node ids unique; rootOrder/then/else/body reference existing nodes,
 *     each node referenced exactly once (the graph is a tree), none orphaned
 *   - bindings parse, reference known upstream steps and declared outputs,
 *     and never reach into a foreach body from outside (only the loop's
 *     aggregated `outputs.results` survives the loop)
 *   - event triggers name catalogued event types; filter keys exist on the
 *     event's subject; schedule crons parse (croner, with timezone)
 *   - select/checkboxes params carry options; declared scopes ∈ vocabulary
 *
 * Pure and synchronous so the editor can re-validate on every config edit.
 */

import { Cron } from 'croner';
import { getEventEntry } from '../events/catalog';
import { isAutomationScope } from './scopes';
import { parseBinding, stepRefsOf, isBindingString, type ParsedBinding } from './bindings';
import type { FlowIr, FlowNode, ParamDef } from './ir-schema';

export interface SemanticIssue {
  code:
    | 'duplicate_node_id'
    | 'unknown_node_ref'
    | 'node_multiply_referenced'
    | 'node_unreachable'
    | 'invalid_binding'
    | 'binding_unknown_step'
    | 'binding_unknown_output'
    | 'binding_not_upstream'
    | 'binding_out_of_scope'
    | 'unknown_event_type'
    | 'unknown_filter_field'
    | 'invalid_cron'
    | 'missing_options'
    | 'unknown_scope'
    | 'param_unfillable_on_event_runs';
  message: string;
  /** Node id / trigger index / param name the issue anchors to (for editor jump). */
  where?: string;
}

export interface ValidateOptions {
  declaredScopes?: string[];
}

interface NodeIndex {
  byId: Map<string, FlowNode>;
  duplicates: string[];
}

function indexNodes(ir: FlowIr): NodeIndex {
  const byId = new Map<string, FlowNode>();
  const duplicates: string[] = [];
  for (const node of ir.nodes) {
    if (byId.has(node.id)) duplicates.push(node.id);
    else byId.set(node.id, node);
  }
  return { byId, duplicates };
}

/**
 * Walk the tree computing, for every python/foreach node, the set of step ids
 * whose outputs are addressable from it. Order semantics:
 *   - siblings in a list see every step completed earlier in that list
 *   - branch/body nodes additionally see everything their ancestors saw
 *   - foreach bodies see the loop's `item` var implicitly (not modeled here)
 *   - after a foreach, ONLY the foreach node itself is addressable (its
 *     implicit `results` output) — body nodes go out of scope
 * Also records reference counts to detect sharing/cycles and orphans.
 */
function analyzeGraph(ir: FlowIr, index: NodeIndex, issues: SemanticIssue[]) {
  const refCounts = new Map<string, number>();
  const available = new Map<string, Set<string>>(); // nodeId -> upstream step ids visible to it
  const insideLoop = new Map<string, string>(); // bodyNodeId -> enclosing foreach id (innermost)

  const visit = (ids: string[], inherited: Set<string>, loopId: string | undefined, path: Set<string>) => {
    const seen = new Set(inherited);
    for (const id of ids) {
      const node = index.byId.get(id);
      refCounts.set(id, (refCounts.get(id) ?? 0) + 1);
      if (!node) {
        issues.push({ code: 'unknown_node_ref', message: `"${id}" is referenced but no node has that id`, where: id });
        continue;
      }
      if (path.has(id)) {
        // A node containing itself through branches — surfaced as multiple refs.
        continue;
      }
      available.set(id, new Set(seen));
      if (loopId) insideLoop.set(id, loopId);

      if (node.kind === 'if') {
        const branchPath = new Set(path).add(id);
        // Branch nodes see the same upstream set as the if node itself.
        visit(node.then, seen, loopId, branchPath);
        visit(node.else, seen, loopId, branchPath);
        // Steps inside branches are NOT addressable after the if (either
        // branch may have been skipped) — only the branches' own scopes see them.
      } else if (node.kind === 'foreach') {
        const bodyPath = new Set(path).add(id);
        visit(node.body, seen, id, bodyPath);
        // After the loop only the foreach's implicit `results` is visible.
      }
      seen.add(id);
    }
  };

  visit(ir.rootOrder, new Set(), undefined, new Set());

  for (const [id, count] of refCounts) {
    if (count > 1) {
      issues.push({
        code: 'node_multiply_referenced',
        message: `Node "${id}" is referenced ${count} times — each node may appear exactly once`,
        where: id,
      });
    }
  }
  for (const node of ir.nodes) {
    if (!refCounts.has(node.id)) {
      issues.push({ code: 'node_unreachable', message: `Node "${node.id}" is not referenced by rootOrder or any branch/body`, where: node.id });
    }
  }
  return { available, insideLoop };
}

function outputsOf(node: FlowNode): Set<string> {
  if (node.kind === 'python') return new Set(node.outputs.map((o) => o.name));
  if (node.kind === 'foreach') return new Set(['results']);
  return new Set(); // if-nodes expose nothing
}

function checkBindingExpr(
  expr: string,
  where: string,
  atNode: string | undefined,
  graph: { available: Map<string, Set<string>>; insideLoop: Map<string, string> },
  index: NodeIndex,
  issues: SemanticIssue[],
) {
  let parsed: ParsedBinding;
  try {
    parsed = parseBinding(expr);
  } catch (err) {
    issues.push({ code: 'invalid_binding', message: err instanceof Error ? err.message : String(err), where });
    return;
  }
  for (const ref of stepRefsOf(parsed)) {
    const target = index.byId.get(ref.stepId);
    if (!target) {
      issues.push({ code: 'binding_unknown_step', message: `Binding references unknown step "${ref.stepId}"`, where });
      continue;
    }
    if (!outputsOf(target).has(ref.output)) {
      issues.push({
        code: 'binding_unknown_output',
        message: `Step "${ref.stepId}" does not declare an output named "${ref.output}"`,
        where,
      });
    }
    if (atNode) {
      const visible = graph.available.get(atNode);
      if (visible && !visible.has(ref.stepId)) {
        // Distinguish "inside a loop body, referenced from outside" from plain ordering.
        const targetLoop = graph.insideLoop.get(ref.stepId);
        const myLoop = graph.insideLoop.get(atNode);
        if (targetLoop && targetLoop !== myLoop) {
          issues.push({
            code: 'binding_out_of_scope',
            message: `"${ref.stepId}" runs inside foreach "${targetLoop}" — after the loop use steps.${targetLoop}.outputs.results instead`,
            where,
          });
        } else {
          issues.push({
            code: 'binding_not_upstream',
            message: `Step "${ref.stepId}" does not execute before "${atNode}" — bindings may only reference upstream outputs`,
            where,
          });
        }
      }
    }
  }
}

function checkParams(params: ParamDef[], atNode: string | undefined, graph: { available: Map<string, Set<string>>; insideLoop: Map<string, string> }, index: NodeIndex, issues: SemanticIssue[]) {
  for (const p of params) {
    const where = atNode ? `${atNode}.${p.name}` : p.name;
    if ((p.control === 'select' || p.control === 'checkboxes') && (!p.options || p.options.length === 0)) {
      issues.push({ code: 'missing_options', message: `Param "${where}" uses control "${p.control}" but declares no options`, where });
    }
    if (p.binding !== undefined) {
      if (!isBindingString(p.binding)) {
        issues.push({ code: 'invalid_binding', message: `Param "${where}" binding must be a single {{ … }} expression`, where });
      } else {
        checkBindingExpr(p.binding, where, atNode, graph, index, issues);
      }
    }
  }
}

export function validateFlowSemantics(ir: FlowIr, opts: ValidateOptions = {}): SemanticIssue[] {
  const issues: SemanticIssue[] = [];
  const index = indexNodes(ir);
  for (const dup of index.duplicates) {
    issues.push({ code: 'duplicate_node_id', message: `Duplicate node id "${dup}"`, where: dup });
  }

  const graph = analyzeGraph(ir, index, issues);

  // Automation-level params: no step refs allowed (they exist before any step).
  const hasUnattendedTrigger = ir.triggers.some((t) => t.kind === 'event' || t.kind === 'schedule');
  for (const p of ir.params) {
    if ((p.control === 'select' || p.control === 'checkboxes') && (!p.options || p.options.length === 0)) {
      issues.push({ code: 'missing_options', message: `Param "${p.name}" uses control "${p.control}" but declares no options`, where: p.name });
    }
    if (p.binding !== undefined) {
      issues.push({ code: 'invalid_binding', message: `Automation-level param "${p.name}" cannot use bindings — it IS an input`, where: p.name });
    }
  }

  // Required node params must still resolve on EVENT/SCHEDULE runs, which
  // supply no manual inputs: a binding whose entire ??-chain reads
  // defaultless automation-level params is a guaranteed
  // "required param resolved to nothing" halt on the first live run —
  // caught here so the authoring repair loop fixes it instead.
  if (hasUnattendedTrigger) {
    const paramHasDefault = new Map(ir.params.map((p) => [p.name, p.value !== undefined]));
    for (const node of ir.nodes) {
      if (node.kind !== 'python') continue;
      for (const p of node.params) {
        if (!p.required || p.binding === undefined || !isBindingString(p.binding)) continue;
        let parsed: ParsedBinding;
        try {
          parsed = parseBinding(p.binding);
        } catch {
          continue; // malformed — already reported as invalid_binding
        }
        if (!parsed.alternatives.every((alt) => alt.root === 'params')) continue;
        const anyDefault = parsed.alternatives.some(
          (alt) => paramHasDefault.get(alt.path[0] ?? '') === true,
        );
        if (!anyDefault) {
          issues.push({
            code: 'param_unfillable_on_event_runs',
            message: `Required param "${node.id}.${p.name}" binds only to automation-level inputs (${parsed.source}), but this flow has event/schedule triggers and those runs supply no manual inputs — the run would halt with "resolved to nothing". Give the referenced automation param a literal default "value", or derive the value from the trigger (e.g. {{ trigger.event.subject.<field> }}) or an earlier step's output.`,
            where: `${node.id}.${p.name}`,
          });
        }
      }
    }
  }

  // Node params + foreach items bindings.
  for (const node of ir.nodes) {
    if (node.kind === 'python') {
      checkParams(node.params, node.id, graph, index, issues);
    } else if (node.kind === 'foreach') {
      if (!isBindingString(node.items)) {
        issues.push({ code: 'invalid_binding', message: `foreach "${node.id}" items must be a {{ … }} expression`, where: node.id });
      } else {
        checkBindingExpr(node.items, `${node.id}.items`, node.id, graph, index, issues);
      }
    }
    // if-node conditions are Python expressions checked by AST lint + pyright.
  }

  // Triggers.
  ir.triggers.forEach((t, i) => {
    if (t.kind === 'event') {
      const entry = getEventEntry(t.eventType);
      if (!entry) {
        issues.push({ code: 'unknown_event_type', message: `Unknown event type "${t.eventType}"`, where: `triggers[${i}]` });
      } else {
        const fields = new Set(entry.subject.map((f) => f.name));
        for (const key of Object.keys(t.filter)) {
          if (!fields.has(key)) {
            issues.push({
              code: 'unknown_filter_field',
              message: `Filter field "${key}" does not exist on ${t.eventType} subjects (has: ${[...fields].join(', ')})`,
              where: `triggers[${i}]`,
            });
          }
        }
      }
    } else if (t.kind === 'schedule') {
      try {
        // Construct without scheduling to validate expression + timezone.
        new Cron(t.cron, { timezone: t.timezone, paused: true }).stop();
      } catch (err) {
        issues.push({
          code: 'invalid_cron',
          message: `Invalid cron "${t.cron}" (${t.timezone}): ${err instanceof Error ? err.message : String(err)}`,
          where: `triggers[${i}]`,
        });
      }
    }
  });

  // Declared scopes.
  for (const scope of opts.declaredScopes ?? []) {
    if (!isAutomationScope(scope)) {
      issues.push({ code: 'unknown_scope', message: `"${scope}" is not a known automation scope`, where: scope });
    }
  }

  return issues;
}
