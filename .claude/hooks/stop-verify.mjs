// Stop: a verification gate. Claude can't end its turn with source changes that fail `npm run check`.
// Skips when nothing in src/ or test/ changed, so chatty/exploratory turns stay fast.
// Disable locally with SKIP_STOP_VERIFY=1 (e.g. in .claude/settings.local.json "env").
import { block, projectRoot, readInput, run, tail } from './lib.mjs';

const input = await readInput();
if (process.env.SKIP_STOP_VERIFY === '1') process.exit(0);
// Already continuing because of this hook: don't loop forever, let the human take over.
if (input.stop_hook_active) process.exit(0);

const root = projectRoot(input.cwd);
// Changed = uncommitted edits, OR commits on this branch that touch src/test but aren't on main yet
// (otherwise an agent could commit broken code and slip past the gate).
const dirty = run('git status --porcelain -- src test', root);
const branch = run('git branch --show-current', root).output.trim();
const committed =
  branch && branch !== 'main' ? run('git diff --quiet main...HEAD -- src test', root) : { ok: true };
const changed = (dirty.ok && dirty.output.trim() !== '') || !committed.ok;
if (!changed) process.exit(0);

const check = run('npm run check --silent', root);
if (!check.ok) {
  block(
    'You changed src/ or test/ but `npm run check` fails. Fix it before finishing, ' +
      'or explain clearly why it cannot pass.\n\n' +
      tail(check.output, 60),
  );
}
process.exit(0);
