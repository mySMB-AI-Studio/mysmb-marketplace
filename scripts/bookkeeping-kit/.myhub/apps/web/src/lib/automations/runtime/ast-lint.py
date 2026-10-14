# AST lint — stage 2 of the validation pipeline
# (architecture/technical/automations.md §10).
#
# Loaded into the sandbox worker ON TOP of sandbox-bootstrap.py (shares its
# ALLOWED_STDLIB / PURE_WHEEL_ROOTS / BINARY_ROOTS so authoring-time rules can
# never drift from runtime enforcement). Pure analysis — never executes the
# authored code.
#
# Per node, checks:
#   * the code parses (syntax errors carry the line number)
#   * imports are inside the allowlist (same sets the runtime importer uses)
#   * banned builtins are not referenced (eval/exec/compile/__import__/
#     globals/vars/input/breakpoint — the runtime removes them, the lint
#     explains them)
#   * `steps` is not referenced (upstream outputs arrive via param bindings)
#   * every declared output is assigned at module level
#   * every free name resolves to params/api/trigger/imports/assignments/
#     safe builtins — undeclared cross-node reads die here, not at runtime

import ast
import builtins
import json
import symtable

# Provided by sandbox-bootstrap.py, which always loads first in the worker.
# The NameError guard keeps this file analyzable/importable standalone.
try:
    ALLOWED_STDLIB  # type: ignore[used-before-def]  # noqa: B018
except NameError:  # pragma: no cover — static analysis only
    ALLOWED_STDLIB: set = set()
    PURE_WHEEL_ROOTS: dict = {}
    BINARY_ROOTS: set = set()

_BANNED_NAMES = {
    "eval": "eval is not available in automation nodes",
    "exec": "exec is not available in automation nodes",
    "compile": "compile is not available in automation nodes",
    "__import__": "use a normal import statement (allowlisted modules only)",
    "globals": "globals() is not available in automation nodes",
    "vars": "vars() is not available in automation nodes",
    "input": "automations cannot prompt for input",
    "breakpoint": "breakpoint() is not available in automation nodes",
}

_AMBIENT_NAMES = {"api", "params", "trigger", "__name__", "__builtins__"}


def _module_level_assignments(tree: ast.Module) -> set:
    """Names assigned in the module namespace (what run_node extracts outputs
    from). Descends into module-level if/try/with/for blocks but NOT into
    function/class bodies — those live in their own scopes."""
    assigned = set()

    def collect_target(target):
        if isinstance(target, ast.Name):
            assigned.add(target.id)
        elif isinstance(target, (ast.Tuple, ast.List)):
            for elt in target.elts:
                collect_target(elt)
        elif isinstance(target, ast.Starred):
            collect_target(target.value)

    def visit_block(stmts):
        for stmt in stmts:
            if isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                assigned.add(stmt.name)
            elif isinstance(stmt, ast.Assign):
                for t in stmt.targets:
                    collect_target(t)
            elif isinstance(stmt, (ast.AnnAssign, ast.AugAssign)):
                collect_target(stmt.target)
            elif isinstance(stmt, (ast.Import, ast.ImportFrom)):
                for alias in stmt.names:
                    assigned.add(alias.asname or alias.name.split(".")[0])
            elif isinstance(stmt, (ast.For, ast.AsyncFor)):
                collect_target(stmt.target)
                visit_block(stmt.body)
                visit_block(stmt.orelse)
            elif isinstance(stmt, (ast.If,)):
                visit_block(stmt.body)
                visit_block(stmt.orelse)
            elif isinstance(stmt, (ast.While,)):
                visit_block(stmt.body)
                visit_block(stmt.orelse)
            elif isinstance(stmt, ast.Try):
                visit_block(stmt.body)
                for handler in stmt.handlers:
                    if handler.name:
                        assigned.add(handler.name)
                    visit_block(handler.body)
                visit_block(stmt.orelse)
                visit_block(stmt.finalbody)
            elif isinstance(stmt, (ast.With, ast.AsyncWith)):
                for item in stmt.items:
                    if item.optional_vars is not None:
                        collect_target(item.optional_vars)
                visit_block(stmt.body)
            elif isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.NamedExpr):
                collect_target(stmt.value.target)

    visit_block(tree.body)

    # Walrus targets anywhere at module level (inside expressions).
    class WalrusCollector(ast.NodeVisitor):
        def visit_NamedExpr(self, node):  # noqa: N802
            collect_target(node.target)
            self.generic_visit(node)

        # Do not descend into new scopes.
        def visit_FunctionDef(self, node):  # noqa: N802
            return

        def visit_AsyncFunctionDef(self, node):  # noqa: N802
            return

        def visit_Lambda(self, node):  # noqa: N802
            return

        def visit_ClassDef(self, node):  # noqa: N802
            return

    WalrusCollector().visit(tree)
    return assigned


def _unresolved_global_names(table, known):
    """Let the actual Python compiler resolve lexical bindings. Its tables
    distinguish imports, exception aliases, nested definitions, closures,
    comprehension targets, class namespaces and annotation scopes. Walking
    every scope's AST stores would incorrectly leak inner locals outward.

    This is lexical resolution, not definite-assignment analysis (pyright and
    the dry-run own that). symtable is privileged lint implementation only;
    it is NOT added to the authored-code import allowlist.
    """
    unresolved = {
        symbol.get_name()
        for symbol in table.get_symbols()
        if symbol.is_referenced() and symbol.is_global()
        and symbol.get_name() not in known
    }
    for child in table.get_children():
        unresolved |= _unresolved_global_names(child, known)
    return unresolved


def _lint_one(node_id, code, declared_outputs, param_names):
    issues = []

    def issue(code_, message, line=None):
        issues.append({"code": code_, "nodeId": node_id, "line": line, "message": message})

    try:
        tree = ast.parse(code, filename=f"<node {node_id}>")
        symbols = symtable.symtable(code, f"<node {node_id}>", "exec")
    except SyntaxError as exc:
        issue("syntax_error", f"syntax error: {exc.msg}", exc.lineno)
        return issues

    allowed_roots = ALLOWED_STDLIB | set(PURE_WHEEL_ROOTS) | BINARY_ROOTS

    for stmt in ast.walk(tree):
        if isinstance(stmt, ast.Import):
            for alias in stmt.names:
                root = alias.name.split(".")[0]
                if root not in allowed_roots:
                    issue("banned_import", f'import of "{alias.name}" is not allowed (allowlist: stdlib subset + doc packages)', stmt.lineno)
        elif isinstance(stmt, ast.ImportFrom):
            root = (stmt.module or "").split(".")[0]
            if stmt.level and stmt.level > 0:
                issue("banned_import", "relative imports are not available in automation nodes", stmt.lineno)
            elif root not in allowed_roots:
                issue("banned_import", f'import from "{stmt.module}" is not allowed (allowlist: stdlib subset + doc packages)', stmt.lineno)

    assigned = _module_level_assignments(tree)

    for name in declared_outputs:
        if name not in assigned:
            issue("output_not_assigned", f'declared output "{name}" is never assigned at the top level of the node', None)

    known = (
        set(param_names)
        | _AMBIENT_NAMES
        | assigned
        | {n for n in vars(builtins) if not n.startswith("_")}
        | {
            symbol.get_name() for symbol in symbols.get_symbols()
            if symbol.is_assigned() or symbol.is_imported() or symbol.is_namespace()
        }
    )
    unresolved = _unresolved_global_names(symbols, known)
    reported = set()
    # Restrictions apply to ALL loads, even when the author shadows a banned
    # builtin or `steps` with a local parameter. Scope resolution must never
    # suppress the sandbox's policy checks. Source-order diagnostics point to
    # the first reference to each spelling; compiler tables carry no columns.
    loads = sorted(
        (node for node in ast.walk(tree)
         if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load)),
        key=lambda node: (node.lineno, node.col_offset),
    )
    for node in loads:
        name, line = node.id, node.lineno
        if name in _BANNED_NAMES:
            if (name, "banned") not in reported:
                issue("banned_name", _BANNED_NAMES[name], line)
                reported.add((name, "banned"))
        elif name == "steps":
            if ("steps", "steps") not in reported:
                issue(
                    "steps_in_code",
                    "node code cannot read `steps` directly — bind upstream outputs into params ({{ steps.<id>.outputs.<name> }})",
                    line,
                )
                reported.add(("steps", "steps"))
        elif name in unresolved:
            if (name, "unknown") not in reported:
                issue("unknown_name", f'"{name}" is not defined — node code can only use params, api, trigger, its imports and its own variables', line)
                reported.add((name, "unknown"))

    return issues


def lint_flow(nodes_json: str) -> str:
    """nodes_json: [{ id, code, declaredOutputs, paramNames }] → issues JSON."""
    nodes = json.loads(nodes_json)
    issues = []
    for node in nodes:
        issues.extend(
            _lint_one(
                node["id"],
                node["code"],
                node.get("declaredOutputs", []),
                node.get("paramNames", []),
            )
        )
    return json.dumps(issues)
