// PostToolUse (Edit|Write|MultiEdit): fast feedback after every TypeScript edit.
// Auto-fixes formatting/lint where possible, then reports remaining type/lint errors back to Claude.
import { block, projectRoot, readInput, rel, run, tail } from './lib.mjs';

const input = await readInput();
const file = input.tool_input?.file_path;
if (!file || !/\.ts$/.test(file)) process.exit(0);

const root = projectRoot(input.cwd);
const p = rel(root, file);
if (p.startsWith('node_modules/') || p.startsWith('dist/')) process.exit(0);

run(`npx prettier --write "${p}"`, root);

const problems = [];
const lint = run(`npx eslint --fix "${p}"`, root);
if (!lint.ok) problems.push(`ESLint (${p}):\n${tail(lint.output)}`);

const types = run('npx tsc --noEmit --pretty false', root);
if (!types.ok) problems.push(`TypeScript:\n${tail(types.output)}`);

if (problems.length) {
  block(
    `Checks failed after editing ${p}. Fix these before moving on:\n\n${problems.join('\n\n')}`,
  );
}
process.exit(0);
