#!/usr/bin/env node
// Run agents in parallel, one git worktree + branch per spec, so they never touch each other's files.
//
//   node scripts/worktree.mjs new 002-health-endpoint      # create .worktrees/002-health-endpoint on agent/002-health-endpoint
//   node scripts/worktree.mjs run 001-task-priority 002-health-endpoint
//                                                          # headless: create worktrees, run `claude -p "/implement …"` in each, in parallel
//   node scripts/worktree.mjs status                       # worktrees, branch, commits ahead of main, running agents
//   node scripts/worktree.mjs rm 002-health-endpoint [--delete-branch]
//
// Logs from `run` go to .worktrees/<slug>.log. Review each branch, then merge it yourself.
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const wtDir = path.join(root, '.worktrees');
const sh = (cmd, opts = {}) => execSync(cmd, { cwd: root, encoding: 'utf8', stdio: 'pipe', ...opts }).trim();

function slugFrom(arg) {
  const slug = path.basename(arg.replace(/\/+$/, ''));
  if (!existsSync(path.join(root, 'specs', slug, 'spec.md'))) {
    throw new Error(`No spec at specs/${slug}/spec.md`);
  }
  return slug;
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
    console.log(`\nNext:\n  cd ${path.relative(process.cwd(), dir)}\n  claude "/plan specs/${slug}"   # then /implement specs/${slug}\n`);
  }
}

function cmdRun(args) {
  const extra = process.env.CLAUDE_ARGS ? process.env.CLAUDE_ARGS.split(' ') : [];
  for (const a of args) {
    const slug = slugFrom(a);
    const status = readFileSync(path.join(root, 'specs', slug, 'spec.md'), 'utf8').match(/^status:\s*(\w+)/m)?.[1];
    if (status !== 'approved') {
      console.error(`✗ ${slug}: spec status is "${status}", not "approved" — skipping`);
      continue;
    }
    const dir = ensureWorktree(slug);
    const log = path.join(wtDir, `${slug}.log`);
    const out = openSync(log, 'w');
    // acceptEdits: file edits are auto-approved; Bash is limited to the allow-list in .claude/settings.json.
    const child = spawn(
      'claude',
      ['-p', `/implement specs/${slug}`, '--permission-mode', 'acceptEdits', ...extra],
      { cwd: dir, detached: true, stdio: ['ignore', out, out], shell: process.platform === 'win32' },
    );
    child.on('error', (e) => console.error(`✗ ${slug}: could not start claude (${e.message})`));
    writeFileSync(path.join(wtDir, `${slug}.pid`), String(child.pid));
    child.unref();
    console.log(`▶ ${slug}: agent started (pid ${child.pid}), log: ${path.relative(process.cwd(), log)}`);
  }
  console.log('\nCheck progress with: node scripts/worktree.mjs status');
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
  const slugs = readdirSync(wtDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  if (!slugs.length) return console.log('No agent worktrees.');
  for (const slug of slugs) {
    const dir = path.join(wtDir, slug);
    const branch = sh('git branch --show-current', { cwd: dir });
    const ahead = sh(`git rev-list --count main..${branch}`);
    const dirty = sh('git status --porcelain', { cwd: dir }) ? ' (uncommitted changes)' : '';
    const pidFile = path.join(wtDir, `${slug}.pid`);
    const pid = existsSync(pidFile) ? Number(readFileSync(pidFile, 'utf8')) : 0;
    const agent = pid ? (isRunning(pid) ? 'agent running' : 'agent finished') : 'interactive';
    console.log(`${slug.padEnd(28)} ${branch.padEnd(34)} +${ahead} commits${dirty}  [${agent}]`);
  }
}

function cmdRm(args) {
  const deleteBranch = args.includes('--delete-branch');
  for (const a of args.filter((x) => !x.startsWith('--'))) {
    const slug = path.basename(a.replace(/\/+$/, ''));
    sh(`git worktree remove "${path.join(wtDir, slug)}" --force`);
    for (const f of [`${slug}.pid`, `${slug}.log`]) {
      if (existsSync(path.join(wtDir, f))) unlinkSync(path.join(wtDir, f));
    }
    if (deleteBranch) sh(`git branch -D agent/${slug}`);
    console.log(`✓ removed ${slug}${deleteBranch ? ' and its branch' : ''}`);
  }
}

const [cmd, ...args] = process.argv.slice(2);
const commands = { new: cmdNew, run: cmdRun, status: cmdStatus, list: cmdStatus, rm: cmdRm };
try {
  if (!commands[cmd]) {
    console.log('Usage: node scripts/worktree.mjs <new|run|status|rm> <spec-slug…> [--no-install] [--delete-branch]');
    process.exit(cmd ? 1 : 0);
  }
  commands[cmd](args);
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
