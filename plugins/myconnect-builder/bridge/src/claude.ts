/**
 * Headless Claude Code driver. Spawns the locally-installed `claude` CLI
 * (reusing the developer's existing login) with -p / --output-format json.
 * One Claude session per WorkQ item, resumed across stages so the plan, the
 * implementation, and the deploys share context. The prompt is written to
 * stdin — never interpolated into a shell string.
 */
import { spawn } from 'node:child_process';

export interface ClaudeRunOptions {
  claudeBin: string;
  cwd: string;
  prompt: string;
  permissionMode: 'plan' | 'default' | 'acceptEdits' | 'bypassPermissions';
  timeoutMs: number;
  resumeSessionId?: string;
}

export interface ClaudeRunResult {
  ok: boolean;
  sessionId?: string;
  /** Final assistant text (CLI `result` field) or captured error output. */
  output: string;
}

export function runClaude(opts: ClaudeRunOptions): Promise<ClaudeRunResult> {
  const args = ['-p', '--output-format', 'json'];
  if (opts.resumeSessionId) args.push('--resume', opts.resumeSessionId);
  if (opts.permissionMode === 'bypassPermissions') {
    args.push('--dangerously-skip-permissions');
  } else {
    args.push('--permission-mode', opts.permissionMode);
  }

  return new Promise((resolve) => {
    // shell:true so `claude` resolves via PATH on Windows (claude.cmd). Args
    // are fixed strings; the prompt goes through stdin, so no injection path.
    const child = spawn(opts.claudeBin, args, {
      cwd: opts.cwd,
      shell: process.platform === 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({ ok: false, output: `Claude run timed out after ${Math.round(opts.timeoutMs / 60000)} min` });
    }, opts.timeoutMs);

    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, output: `Failed to start ${opts.claudeBin}: ${err.message}` });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const parsed = parseCliJson(stdout);
      if (code === 0 && parsed) {
        resolve({ ok: !parsed.isError, sessionId: parsed.sessionId, output: parsed.result });
      } else {
        resolve({
          ok: false,
          sessionId: parsed?.sessionId,
          output: parsed?.result || stderr || stdout || `claude exited with code ${code}`,
        });
      }
    });

    child.stdin.write(opts.prompt);
    child.stdin.end();
  });
}

function parseCliJson(stdout: string): { sessionId?: string; result: string; isError: boolean } | null {
  // `--output-format json` prints one JSON object; tolerate stray log lines
  // around it by scanning for the outermost object.
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(stdout.slice(start, end + 1)) as {
      session_id?: string;
      result?: string;
      is_error?: boolean;
      subtype?: string;
    };
    return {
      sessionId: obj.session_id,
      result: obj.result ?? '',
      isError: obj.is_error === true || (obj.subtype !== undefined && obj.subtype !== 'success'),
    };
  } catch {
    return null;
  }
}
