// Turns Claude Code's `--output-format stream-json --verbose` events into readable log lines and a
// small progress state. Event shapes: https://code.claude.com/docs/en/headless (Stream responses).
//   system/init · assistant (text, tool_use) · user (tool_result) · system/api_retry ·
//   system/permission_denied · result. Subagent messages carry a non-null parent_tool_use_id.

const short = (s, n = 140) => {
  const t = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const relPath = (p, cwd) => (p && cwd && p.startsWith(`${cwd}/`) ? p.slice(cwd.length + 1) : p);

export function fmtDuration(ms) {
  if (!Number.isFinite(ms)) return '?';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m${s % 60 ? ` ${s % 60}s` : ''}` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function describeToolUse(block, cwd) {
  const i = block.input ?? {};
  switch (block.name) {
    case 'Read':
      return `Read    ${relPath(i.file_path, cwd)}`;
    case 'Edit':
    case 'MultiEdit':
      return `Edit    ${relPath(i.file_path, cwd)}`;
    case 'Write':
      return `Write   ${relPath(i.file_path, cwd)}`;
    case 'Bash':
      return `Bash    ${short(i.command, 120)}`;
    case 'Grep':
      return `Grep    ${short(i.pattern, 60)}${i.path ? ` in ${relPath(i.path, cwd)}` : ''}`;
    case 'Glob':
      return `Glob    ${short(i.pattern, 80)}`;
    case 'Task':
    case 'Agent':
      return `Agent   ${i.subagent_type ?? 'subagent'}: ${short(i.description ?? i.prompt, 100)}`;
    case 'TodoWrite': {
      const todos = i.todos ?? [];
      const done = todos.filter((t) => t.status === 'completed').length;
      return `Todos   ${done}/${todos.length} done`;
    }
    case 'Skill':
      return `Skill   ${i.skill ?? i.name ?? ''}`;
    default:
      return `${String(block.name).padEnd(7)} ${short(JSON.stringify(i), 100)}`;
  }
}

const resultText = (c) =>
  typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x.text ?? '').join(' ') : '';

/** Readable lines for one event (no timestamp). Unknown or noisy events return []. */
export function formatEvent(evt, cwd) {
  const sub = evt.parent_tool_use_id ? '  ↳ ' : '';
  const content = evt.message?.content;
  switch (evt.type) {
    case 'system':
      if (evt.subtype === 'init') return [`Session started · model ${evt.model ?? '?'}`];
      if (evt.subtype === 'api_retry') {
        return [`⟳ API retry ${evt.attempt}/${evt.max_retries} (${evt.error ?? evt.error_status})`];
      }
      if (evt.subtype === 'permission_denied') {
        return [
          `⛔ Permission denied: ${short(evt.tool_name ?? evt.message ?? JSON.stringify(evt), 140)}`,
        ];
      }
      return [];
    case 'assistant':
      if (!Array.isArray(content)) return [];
      return content.flatMap((b) => {
        if (b.type === 'tool_use') return [`${sub}${describeToolUse(b, cwd)}`];
        if (b.type === 'text' && !sub && b.text?.trim()) return [`💬 ${short(b.text, 200)}`];
        return [];
      });
    case 'user':
      if (!Array.isArray(content)) return [];
      return content
        .filter((b) => b.type === 'tool_result' && b.is_error)
        .map((b) => `${sub}✗ ${short(resultText(b.content), 200)}`);
    case 'result': {
      const cost =
        typeof evt.total_cost_usd === 'number' ? ` · $${evt.total_cost_usd.toFixed(2)}` : '';
      return [
        `■ Finished: ${evt.subtype}${evt.is_error ? ' (error)' : ''} · ${evt.num_turns ?? '?'} turns · ` +
          `${fmtDuration(evt.duration_ms)}${cost}`,
      ];
    }
    default:
      return [];
  }
}

/** Fold an event into the progress state shown by `worktree.mjs status`. */
export function updateState(state, evt, cwd) {
  state.lastEventAt = Date.now();
  if (evt.type === 'system' && evt.subtype === 'init') state.model = evt.model;
  if (evt.type === 'assistant' && Array.isArray(evt.message?.content)) {
    for (const b of evt.message.content) {
      if (b.type !== 'tool_use') continue;
      state.toolCalls = (state.toolCalls ?? 0) + 1;
      state.lastAction = `${evt.parent_tool_use_id ? '↳ ' : ''}${describeToolUse(b, cwd)}`;
    }
  }
  if (evt.type === 'user' && Array.isArray(evt.message?.content)) {
    state.errors =
      (state.errors ?? 0) +
      evt.message.content.filter((b) => b.type === 'tool_result' && b.is_error).length;
  }
  if (evt.type === 'result') {
    state.result = {
      subtype: evt.subtype,
      isError: !!evt.is_error,
      turns: evt.num_turns,
      durationMs: evt.duration_ms,
      costUsd: evt.total_cost_usd,
    };
  }
  return state;
}
