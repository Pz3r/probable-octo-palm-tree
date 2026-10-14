#!/usr/bin/env node
// Run agents in parallel, one git worktree + branch per spec, so they never touch each other's files.
//
//   node scripts/worktree.mjs new 002-health-endpoint        # .worktrees/002-health-endpoint on agent/002-health-endpoint
//   node scripts/worktree.mjs run 001-task-priority 002-...  # headless agents in parallel; each opens a draft PR when done
//   node scripts/worktree.mjs run 002-health-endpoint --no-pr  # headless, but leave the branch local
//   node scripts/worktree.mjs pr 002-health-endpoint [--ready] # validate, push, open (or update) the PR yourself
//   node scripts/worktree.mjs status                         # branch, commits ahead, agent state, PR result
//   node scripts/worktree.mjs rm 002-health-endpoint [--delete-branch]
//
// Agents never push: `.claude/settings.json` doesn't allow it. This script does, and only after the
// branch is an agent/* branch, fully committed and passing `npm run check`. PRs are drafts by default.
// Needs a GitHub `origin` remote and an authenticated GitHub CLI (`gh auth login`).
import { execFileSync, execSync, spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  console.log('\nCheck progress with: node scripts/worktree.mjs status');
}

/** Internal: the background job started by `run`. Output goes to the log file. */
function cmdAgent([slug, ...rest]) {
  const dir = path.join(wtDir, slug);
  const extra = process.env.CLAUDE_ARGS ? process.env.CLAUDE_ARGS.split(' ') : [];
  console.log(`[${new Date().toISOString()}] agent starting: /implement specs/${slug}`);
  setResult(slug, 'running');
  // acceptEdits: file edits are auto-approved; Bash is limited to the allow-list in .claude/settings.json.
  const res = spawnSync(
    'claude',
    ['-p', `/implement specs/${slug}`, '--permission-mode', 'acceptEdits', ...extra],
    { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' },
  );
  console.log(
    `\n[${new Date().toISOString()}] agent exited with code ${res.status ?? res.error?.message}`,
  );
  if (res.status !== 0) return setResult(slug, `agent failed (exit ${res.status ?? 'n/a'}), no PR`);
  if (rest.includes('--no-pr')) return setResult(slug, 'done (--no-pr)');
  try {
    const url = openPr(slug);
    setResult(slug, `PR: ${url}`);
  } catch (e) {
    console.error(`✗ PR not opened: ${e.message}`);
    setResult(slug, `done, PR not opened: ${e.message.split('\n')[0]}`);
  }
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

function cmdStatus() {
  if (!existsSync(wtDir)) return console.log('No agent worktrees.');
  const slugs = readdirSync(wtDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  if (!slugs.length) return console.log('No agent worktrees.');
  for (const slug of slugs) {
    const dir = path.join(wtDir, slug);
    const branch = sh('git branch --show-current', { cwd: dir });
    const ahead = sh(`git rev-list --count main..${branch}`);
    const dirty = sh('git status --porcelain', { cwd: dir }) ? ' (uncommitted changes)' : '';
    const pidFile = path.join(wtDir, `${slug}.pid`);
    const pid = existsSync(pidFile) ? Number(readFileSync(pidFile, 'utf8')) : 0;
    const agent = pid ? (isRunning(pid) ? 'agent running' : 'agent finished') : 'interactive';
    const result = existsSync(resultFile(slug))
      ? `  ${readFileSync(resultFile(slug), 'utf8')}`
      : '';
    console.log(
      `${slug.padEnd(28)} ${branch.padEnd(34)} +${ahead} commits${dirty}  [${agent}]${result}`,
    );
  }
}

function cmdRm(args) {
  const deleteBranch = args.includes('--delete-branch');
  for (const a of args.filter((x) => !x.startsWith('--'))) {
    const slug = path.basename(a.replace(/\/+$/, ''));
    sh(`git worktree remove "${path.join(wtDir, slug)}" --force`);
    for (const f of [`${slug}.pid`, `${slug}.log`, `${slug}.result`, `${slug}.pr-body.md`]) {
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
  rm: cmdRm,
  _agent: cmdAgent,
};
try {
  if (!commands[cmd]) {
    console.log(
      'Usage: node scripts/worktree.mjs <new|run|pr|status|rm> <spec-slug…> ' +
        '[--no-install] [--no-pr] [--ready] [--delete-branch]',
    );
    process.exit(cmd ? 1 : 0);
  }
  commands[cmd](args);
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
