#!/usr/bin/env node
// Run agents in parallel, one git worktree + branch per spec, so they never touch each other's files.
//
//   node scripts/worktree.mjs new 002-health-endpoint        # .worktrees/002-health-endpoint on agent/002-health-endpoint
//   node scripts/worktree.mjs run 001-task-priority 002-...  # headless agents in parallel; each opens a draft PR when done
//   node scripts/worktree.mjs run 002-health-endpoint --no-pr  # headless, but leave the branch local
//   node scripts/worktree.mjs pr 002-health-endpoint [--ready] # validate, push, open (or update) the PR yourself
//   node scripts/worktree.mjs status                         # progress: tasks, tool calls, idle time, last commit, PR
//   node scripts/worktree.mjs logs 002-health-endpoint        # live activity log (follows while the agent runs)
//   node scripts/worktree.mjs rm 002-health-endpoint [--delete-branch]
//
// Agents never push: `.claude/settings.json` doesn't allow it. This script does, and only after the
// branch is an agent/* branch, fully committed and passing `npm run check`. PRs are drafts by default.
// Needs a GitHub `origin` remote and an authenticated GitHub CLI (`gh auth login`).
import { execFileSync, execSync, spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { fmtDuration, formatEvent, updateState } from './agent-events.mjs';

const SELF = fileURLToPath(import.meta.url);
const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const wtDir = path.join(root, '.worktrees');
const AGENT_BRANCH = /^agent\/[\w.-]+$/;
// Files that change how the project is checked. Agents editing these get flagged in the PR.
const TOOLING =
  /^(package(-lock)?\.json|tsconfig[^/]*\.json|jest\.config\.[cm]?js|eslint\.config\.[cm]?js|\.prettierrc.*|scripts\/|\.claude\/|\.github\/)/;

const sh = (cmd, opts = {}) =>
  execSync(cmd, { cwd: root, encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
const trySh = (cmd, opts = {}) => {
  try {
    return sh(cmd, opts);
  } catch {
    return null;
  }
};
const resultFile = (slug) => path.join(wtDir, `${slug}.result`);
const setResult = (slug, text) => writeFileSync(resultFile(slug), text);
const stateFile = (slug) => path.join(wtDir, `${slug}.state.json`);
const logFile = (slug) => path.join(wtDir, `${slug}.log`);
const readJson = (f) => {
  try {
    return JSON.parse(readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
};
const hhmmss = () => new Date().toTimeString().slice(0, 8);
const STALE_MIN = Number(process.env.AGENT_STALE_MIN ?? 15);
// Headless runs have nobody to answer questions or approve a plan; say so explicitly.
const UNATTENDED_NOTE =
  'You are running unattended in a background job: nobody can answer questions or give a go-ahead. ' +
  'Never stop to wait for approval. Work through the whole /implement loop and finish with every ' +
  'change committed and specs/<slug>/pr.md written. If you genuinely cannot continue (spec impossible ' +
  'or contradictory, missing access), commit what you have, explain why in your final message, and stop.';

function slugFrom(arg) {
  const slug = path.basename(arg.replace(/\/+$/, ''));
  if (!existsSync(path.join(root, 'specs', slug, 'spec.md'))) {
    throw new Error(`No spec at specs/${slug}/spec.md`);
  }
  return slug;
}

function specField(slug, field, dir = root) {
  const file = path.join(dir, 'specs', slug, 'spec.md');
  const src = existsSync(file) ? file : path.join(root, 'specs', slug, 'spec.md');
  return readFileSync(src, 'utf8').match(new RegExp(`^${field}:\\s*(.+?)\\s*(#.*)?$`, 'm'))?.[1];
}

function ensureWorktree(slug, { install = true } = {}) {
  const dir = path.join(wtDir, slug);
  if (existsSync(dir)) return dir;
  mkdirSync(wtDir, { recursive: true });
  const branch = `agent/${slug}`;
  const branchExists = sh(`git branch --list ${branch}`) !== '';
  sh(`git worktree add "${dir}" ${branchExists ? branch : `-b ${branch} main`}`);
  console.log(`✓ worktree ${path.relative(root, dir)} on ${branch}`);
  if (install) {
    console.log('  installing dependencies (npm ci)…');
    execSync('npm ci --no-audit --no-fund --loglevel=error', { cwd: dir, stdio: 'inherit' });
  }
  return dir;
}

function cmdNew(args) {
  const install = !args.includes('--no-install');
  for (const a of args.filter((x) => !x.startsWith('--'))) {
    const slug = slugFrom(a);
    const dir = ensureWorktree(slug, { install });
    console.log(
      `\nNext:\n  cd ${path.relative(process.cwd(), dir)}\n  claude "/plan specs/${slug}"   # then /implement specs/${slug}\n` +
        `  node scripts/worktree.mjs pr ${slug}   # when done: push + draft PR\n`,
    );
  }
}

function cmdRun(args) {
  const noPr = args.includes('--no-pr');
  for (const a of args.filter((x) => !x.startsWith('--'))) {
    const slug = slugFrom(a);
    const status = specField(slug, 'status');
    if (status !== 'approved') {
      console.error(`✗ ${slug}: spec status is "${status}", not "approved", skipping`);
      continue;
    }
    ensureWorktree(slug);
    if (existsSync(resultFile(slug))) unlinkSync(resultFile(slug));
    const log = path.join(wtDir, `${slug}.log`);
    const out = openSync(log, 'w');
    // The background job is this script (from the main checkout, not the agent's worktree, so the
    // agent can't edit what runs after it): run the agent, then open the PR if it succeeded.
    const child = spawn(process.execPath, [SELF, '_agent', slug, ...(noPr ? ['--no-pr'] : [])], {
      cwd: root,
      detached: true,
      stdio: ['ignore', out, out],
    });
    writeFileSync(path.join(wtDir, `${slug}.pid`), String(child.pid));
    child.unref();
    console.log(
      `▶ ${slug}: agent started (pid ${child.pid})${noPr ? '' : ', draft PR when it succeeds'}; ` +
        `log: ${path.relative(process.cwd(), log)}`,
    );
  }
  console.log(
    '\nProgress: node scripts/worktree.mjs status   ·   live log: node scripts/worktree.mjs logs <slug>',
  );
}

/** Desktop notification when a background agent finishes (macOS/Linux; AGENT_NOTIFY=0 to disable). */
function notify(title, message) {
  if (process.env.AGENT_NOTIFY === '0') return;
  const esc = (t) => String(t).replace(/["\\]/g, '\\$&');
  try {
    if (process.platform === 'darwin') {
      execFileSync('osascript', [
        '-e',
        `display notification "${esc(message)}" with title "${esc(title)}"`,
      ]);
    } else if (process.platform === 'linux' && trySh('command -v notify-send')) {
      execFileSync('notify-send', [title, message]);
    }
  } catch {
    // Notifications are best-effort.
  }
}

/**
 * Internal: the background job started by `run`. Runs the agent with streaming JSON output, writes a
 * readable activity log (stdout of this process = .worktrees/<slug>.log), the raw events
 * (<slug>.events.jsonl) and a progress state (<slug>.state.json), then opens the PR on success.
 */
async function cmdAgent([slug, ...rest]) {
  const dir = path.join(wtDir, slug);
  const extra = process.env.CLAUDE_ARGS ? process.env.CLAUDE_ARGS.split(' ') : [];
  const log = (line) => console.log(`${hhmmss()}  ${line}`);
  const state = { startedAt: Date.now(), lastEventAt: Date.now(), toolCalls: 0, errors: 0 };
  const save = () => writeFileSync(stateFile(slug), JSON.stringify(state));
  save();
  setResult(slug, 'running');
  log(`Agent starting: /implement specs/${slug}`);

  const events = createWriteStream(path.join(wtDir, `${slug}.events.jsonl`));
  // acceptEdits: file edits are auto-approved; Bash is limited to the allow-list in .claude/settings.json.
  const child = spawn(
    'claude',
    [
      '-p',
      `/implement specs/${slug}`,
      '--permission-mode',
      'acceptEdits',
      '--output-format',
      'stream-json',
      '--verbose',
      '--append-system-prompt',
      UNATTENDED_NOTE,
      ...extra,
    ],
    { cwd: dir, stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' },
  );
  const exited = new Promise((resolve) => {
    child.on('error', (e) => {
      log(`✗ Could not start claude: ${e.message}`);
      resolve(-1);
    });
    child.on('close', (code) => resolve(code));
  });
  for await (const line of createInterface({ input: child.stdout })) {
    if (!line.trim()) continue;
    events.write(`${line}\n`);
    let evt;
    try {
      evt = JSON.parse(line);
    } catch {
      log(line);
      continue;
    }
    for (const l of formatEvent(evt, dir)) log(l);
    updateState(state, evt, dir);
    save();
  }
  const code = await exited;
  events.end();
  Object.assign(state, { exitCode: code, finishedAt: Date.now() });
  save();
  log(`Agent exited with code ${code}`);

  // An agent can exit 0 without finishing (e.g. it stopped to ask something). Check before the PR.
  const unfinished = [];
  if (code === 0) {
    const dirty = sh('git status --porcelain', { cwd: dir });
    if (dirty)
      unfinished.push(
        `uncommitted: ${dirty
          .split('\n')
          .map((l) => l.slice(3))
          .join(', ')}`,
      );
    const tasks = taskProgress(dir, slug);
    const m = tasks?.match(/(\d+)\/(\d+)/);
    if (m && m[1] !== m[2]) unfinished.push(tasks);
    if (!existsSync(path.join(dir, 'specs', slug, 'pr.md'))) unfinished.push('no pr.md');
  }

  let outcome;
  if (code !== 0) {
    outcome = `agent failed (exit ${code}), no PR`;
  } else if (unfinished.length) {
    outcome = `agent stopped before finishing (${unfinished.join('; ')}), no PR. Check the log, then re-run`;
  } else if (rest.includes('--no-pr')) {
    outcome = 'done (--no-pr)';
  } else {
    try {
      outcome = `PR: ${openPr(slug)}`;
    } catch (e) {
      console.error(`✗ PR not opened: ${e.message}`);
      outcome = `done, PR not opened: ${e.message.split('\n')[0]}`;
    }
  }
  setResult(slug, outcome);
  notify(`agent-lab: ${slug}`, outcome);
}

function prBody(slug, dir, branch) {
  const parts = [];
  const prMd = path.join(dir, 'specs', slug, 'pr.md');
  if (existsSync(prMd)) {
    parts.push(readFileSync(prMd, 'utf8').trim());
  } else {
    const commits = sh(`git log --reverse --format="- %s" main..${branch}`, { cwd: dir });
    parts.push(
      `Implements [\`specs/${slug}/spec.md\`](specs/${slug}/spec.md).\n\n## Commits\n${commits}`,
    );
  }
  const tooling = sh(`git diff --name-only main...${branch}`, { cwd: dir })
    .split('\n')
    .filter((f) => TOOLING.test(f));
  if (tooling.length) {
    parts.push(
      '## ⚠️ Tooling files changed\nThese affect how the branch is checked (scripts, configs, guardrails). ' +
        'Review them before trusting the green check:\n' +
        tooling.map((f) => `- \`${f}\``).join('\n'),
    );
  }
  parts.push(
    '---\nOpened by `scripts/worktree.mjs pr` after `npm run check` passed on this branch. ' +
      'Draft until a human has reviewed it.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)',
  );
  return parts.join('\n\n') + '\n';
}

/** Validate an agent branch, push it, and open a draft PR (or update the existing one). Returns the PR URL. */
function openPr(slug, { ready = false } = {}) {
  const dir = path.join(wtDir, slug);
  if (!existsSync(dir)) throw new Error(`No worktree at .worktrees/${slug}`);
  const branch = sh('git branch --show-current', { cwd: dir });
  if (!AGENT_BRANCH.test(branch)) throw new Error(`Refusing: ${branch} is not an agent/* branch`);
  if (sh('git status --porcelain', { cwd: dir })) {
    throw new Error(`Refusing: .worktrees/${slug} has uncommitted changes`);
  }
  if (Number(sh(`git rev-list --count main..${branch}`, { cwd: dir })) === 0) {
    throw new Error(`Refusing: ${branch} has no commits ahead of main`);
  }
  if (trySh('git remote get-url origin', { cwd: dir }) === null) {
    throw new Error(
      'No `origin` remote. Create the GitHub repo and `git remote add origin …` first',
    );
  }
  if (trySh('gh auth status', { cwd: dir }) === null) {
    throw new Error('GitHub CLI not installed or not logged in. Run `gh auth login`');
  }

  console.log(`→ ${slug}: npm run check…`);
  const check = spawnSync('npm', ['run', 'check'], {
    cwd: dir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (check.status !== 0) throw new Error(`Refusing: npm run check fails on ${branch}`);

  console.log(`→ ${slug}: pushing ${branch}…`);
  execFileSync('git', ['push', '-u', 'origin', branch], { cwd: dir, stdio: 'inherit' });

  const existing = trySh(`gh pr view ${branch} --json url --jq .url`, { cwd: dir });
  if (existing) {
    console.log(`✓ ${slug}: pushed; existing PR updated: ${existing}`);
    return existing;
  }

  const bodyFile = path.join(wtDir, `${slug}.pr-body.md`);
  writeFileSync(bodyFile, prBody(slug, dir, branch));
  const title = `feat: ${specField(slug, 'title', dir) ?? slug} (spec ${slug.split('-')[0]})`;
  const url = execFileSync(
    'gh',
    [
      'pr',
      'create',
      '--base',
      'main',
      '--head',
      branch,
      '--title',
      title,
      '--body-file',
      bodyFile,
      ...(ready ? [] : ['--draft']),
    ],
    { cwd: dir, encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .pop();
  console.log(`✓ ${slug}: ${ready ? 'PR' : 'draft PR'} opened: ${url}`);
  return url;
}

function cmdPr(args) {
  const ready = args.includes('--ready');
  let failed = false;
  for (const a of args.filter((x) => !x.startsWith('--'))) {
    const slug = slugFrom(a);
    try {
      setResult(slug, `PR: ${openPr(slug, { ready })}`);
    } catch (e) {
      failed = true;
      console.error(`✗ ${slug}: ${e.message}`);
    }
  }
  if (failed) process.exit(1);
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function taskProgress(dir, slug) {
  const f = path.join(dir, 'specs', slug, 'tasks.md');
  if (!existsSync(f)) return null;
  const src = readFileSync(f, 'utf8');
  const done = (src.match(/^\s*[-*] \[x\]/gim) ?? []).length;
  const open = (src.match(/^\s*[-*] \[ \]/gm) ?? []).length;
  return done + open ? `tasks ${done}/${done + open}` : null;
}

function cmdStatus() {
  const slugs = existsSync(wtDir)
    ? readdirSync(wtDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];
  if (!slugs.length) return console.log('No agent worktrees.');
  const now = Date.now();
  for (const slug of slugs) {
    const dir = path.join(wtDir, slug);
    const branch = sh('git branch --show-current', { cwd: dir });
    const ahead = Number(sh(`git rev-list --count main..${branch}`));
    const dirty = sh('git status --porcelain', { cwd: dir }) ? ', uncommitted changes' : '';
    const pidFile = path.join(wtDir, `${slug}.pid`);
    const pid = existsSync(pidFile) ? Number(readFileSync(pidFile, 'utf8')) : 0;
    const running = pid > 0 && isRunning(pid);
    const st = readJson(stateFile(slug));
    const result = existsSync(resultFile(slug)) ? readFileSync(resultFile(slug), 'utf8') : '';

    const head = [];
    if (running) {
      head.push(`● running ${fmtDuration(now - (st?.startedAt ?? now))}`);
      if (st) head.push(`idle ${fmtDuration(now - st.lastEventAt)}`);
    } else if (pid && st && st.exitCode === undefined) {
      // The background job died without recording an exit (killed, machine restarted, …).
      head.push(`⚠ stopped unexpectedly after ${fmtDuration(st.lastEventAt - st.startedAt)}`);
    } else if (pid) {
      const ok = st?.exitCode === 0;
      const early = result.startsWith('agent stopped before finishing');
      head.push(early ? '⚠ stopped early' : `${ok ? '✓' : '✗'} finished`);
      if (st?.finishedAt) head.push(fmtDuration(st.finishedAt - st.startedAt));
      if (typeof st?.result?.costUsd === 'number') head.push(`$${st.result.costUsd.toFixed(2)}`);
    } else {
      head.push('◦ interactive');
    }
    if (st?.toolCalls)
      head.push(`${st.toolCalls} tool calls${st.errors ? ` (${st.errors} errors)` : ''}`);
    const tasks = taskProgress(dir, slug);
    if (tasks) head.push(tasks);
    console.log(`${slug}  ${head.join(' · ')}`);

    const last = ahead ? sh(`git log -1 --format="%s (%cr)" ${branch}`) : 'no commits yet';
    console.log(`    ${branch}  +${ahead}${dirty}  last: ${last}`);
    if (running && st?.lastAction) console.log(`    now: ${st.lastAction}`);
    if (running && st && now - st.lastEventAt > STALE_MIN * 60_000) {
      console.log(
        `    ⚠ no activity for ${fmtDuration(now - st.lastEventAt)}; check: node scripts/worktree.mjs logs ${slug}`,
      );
    }
    if (!running && result === 'running') {
      console.log(`    no result recorded; inspect the log, then re-run or open the PR by hand`);
    } else if (!running && result) console.log(`    ${result}`);
  }
}

/** Print an agent's activity log; keep following it while the agent runs (like tail -f). */
async function cmdLogs(args) {
  const slug = args.find((a) => !a.startsWith('--'));
  if (!slug) throw new Error('Usage: node scripts/worktree.mjs logs <slug> [--no-follow] [--raw]');
  const file = args.includes('--raw') ? path.join(wtDir, `${slug}.events.jsonl`) : logFile(slug);
  if (!existsSync(file)) throw new Error(`No log for ${slug} yet (${path.relative(root, file)})`);
  const pidFile = path.join(wtDir, `${slug}.pid`);
  const alive = () => existsSync(pidFile) && isRunning(Number(readFileSync(pidFile, 'utf8')));
  let pos = 0;
  const drain = () => {
    const size = statSync(file).size;
    if (size <= pos) return false;
    const fd = openSync(file, 'r');
    const buf = Buffer.alloc(size - pos);
    readSync(fd, buf, 0, buf.length, pos);
    closeSync(fd);
    process.stdout.write(buf);
    pos = size;
    return true;
  };
  drain();
  if (args.includes('--no-follow') || !alive()) return;
  console.error(`— following ${path.relative(root, file)} (Ctrl+C to stop) —`);
  let quiet = 0;
  // Keep going while the agent runs; stop a couple of seconds after it exits and the log is drained.
  while (true) {
    await new Promise((r) => setTimeout(r, 1000));
    if (drain()) quiet = 0;
    else if (!alive() && ++quiet >= 2) break;
  }
  console.error('— agent finished —');
}

function cmdRm(args) {
  const deleteBranch = args.includes('--delete-branch');
  for (const a of args.filter((x) => !x.startsWith('--'))) {
    const slug = path.basename(a.replace(/\/+$/, ''));
    sh(`git worktree remove "${path.join(wtDir, slug)}" --force`);
    for (const f of ['pid', 'log', 'result', 'pr-body.md', 'events.jsonl', 'state.json'].map(
      (x) => `${slug}.${x}`,
    )) {
      if (existsSync(path.join(wtDir, f))) unlinkSync(path.join(wtDir, f));
    }
    if (deleteBranch) sh(`git branch -D agent/${slug}`);
    console.log(`✓ removed ${slug}${deleteBranch ? ' and its local branch' : ''}`);
  }
}

const [cmd, ...args] = process.argv.slice(2);
const commands = {
  new: cmdNew,
  run: cmdRun,
  pr: cmdPr,
  status: cmdStatus,
  list: cmdStatus,
  logs: cmdLogs,
  rm: cmdRm,
  _agent: cmdAgent,
};
try {
  if (!commands[cmd]) {
    console.log(
      'Usage: node scripts/worktree.mjs <new|run|pr|status|logs|rm> <spec-slug…> ' +
        '[--no-install] [--no-pr] [--ready] [--delete-branch]',
    );
    process.exit(cmd ? 1 : 0);
  }
  await commands[cmd](args);
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
