// PreToolUse (Edit|Write|MultiEdit): deterministic guardrails that a prompt alone can't guarantee.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { block, projectRoot, readInput, rel } from './lib.mjs';

const input = await readInput();
const file = input.tool_input?.file_path;
if (!file) process.exit(0);

const root = projectRoot(input.cwd);
const p = rel(root, file);

const PROTECTED = [
  [/^\.env(?!\.example$)(\..*)?$/, 'Secrets files are off-limits to agents.'],
  [/(^|\/)package-lock\.json$/, 'Use npm install/uninstall instead of editing the lockfile.'],
  [
    /^\.github\/workflows\//,
    'CI workflows are human-owned. Propose the change in your summary instead.',
  ],
  [/^\.claude\/hooks\//, 'Agents may not modify their own guardrails.'],
  [/^\.\.\//, 'Writes outside the project are not allowed.'],
];

for (const [re, why] of PROTECTED) {
  if (re.test(p)) block(`Blocked edit to ${p}: ${why}`);
}

// Approved specs are the contract. If the agent thinks one is wrong, a human decides.
if (/^specs\/[^/]+\/spec\.md$/.test(p)) {
  const abs = path.resolve(root, p);
  if (existsSync(abs) && /^status:\s*approved\s*$/m.test(readFileSync(abs, 'utf8'))) {
    block(
      `Blocked edit to ${p}: this spec is approved. If the code can't satisfy it or it's ambiguous, ` +
        'stop and explain the problem to the human instead of changing the spec.',
    );
  }
}

process.exit(0);
