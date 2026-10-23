import { checkChanges } from './ci.mts';

const errors = checkChanges(process.env.NOSTRANSLATION_BASE ?? 'origin/main');
if (errors.length) {
  process.stderr.write(errors.join('\n') + '\n');
  process.exitCode = 1;
}
