// Shared helpers for Claude Code hooks. Node-only so hooks work on macOS, Linux and Windows (Git Bash).
import { execSync } from 'node:child_process';
import path from 'node:path';

/** Hooks receive a JSON payload on stdin. */
export async function readInput() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

/** Project root: Claude sets CLAUDE_PROJECT_DIR; fall back to git (works inside worktrees). */
export function projectRoot(cwd = process.cwd()) {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  try {
    return execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8' }).trim();
  } catch {
    return cwd;
  }
}

/** Path relative to the project root, with forward slashes. */
export function rel(root, file) {
  return path.relative(root, path.resolve(root, file)).split(path.sep).join('/');
}

/** Run a command; return { ok, output }. */
export function run(cmd, cwd) {
  try {
    const output = execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, output };
  } catch (err) {
    return { ok: false, output: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

/**
 * Exit code 2 = blocking. For PreToolUse it cancels the tool call; for PostToolUse/Stop
 * the stderr message is fed back to Claude so it can fix the problem.
 */
export function block(message) {
  process.stderr.write(message.trim() + '\n');
  process.exit(2);
}

export function tail(text, lines = 40) {
  return text.trim().split('\n').slice(-lines).join('\n');
}
