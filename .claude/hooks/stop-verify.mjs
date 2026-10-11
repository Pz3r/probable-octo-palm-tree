// Stop: a verification gate. Claude can't end its turn with source changes that fail `npm run check`.
// Skips when nothing in src/ or test/ changed, so chatty/exploratory turns stay fast.
// Disable locally with SKIP_STOP_VERIFY=1 (e.g. in .claude/settings.local.json "env").
import { block, projectRoot, readInput, run, tail } from './lib.mjs';

const input = await readInput();
if (process.env.SKIP_STOP_VERIFY === '1') process.exit(0);
// Already continuing because of this hook: don't loop forever, let the human take over.
if (input.stop_hook_active) process.exit(0);

const root = projectRoot(input.cwd);
const status = run('git status --porcelain -- src test', root);
if (!status.ok || status.output.trim() === '') process.exit(0);

const check = run('npm run check --silent', root);
if (!check.ok) {
  block(
    'You changed src/ or test/ but `npm run check` fails. Fix it before finishing, ' +
      'or explain clearly why it cannot pass.\n\n' +
      tail(check.output, 60),
  );
}
process.exit(0);
