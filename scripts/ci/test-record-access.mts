import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const testFiles = [
  'modules/messages/tests/server/message.server.routes.tests.js',
  'modules/contacts/tests/server/contact.server.routes.tests.js',
  'modules/references-thread/tests/server/reference-thread.server.routes.tests.js',
  'modules/offers/tests/server/offer.server.routes.tests.js',
].map(file => {
  const typedFile = file.replace(/\.js$/, '.cts');
  return existsSync(typedFile) ? typedFile : file;
});

const packageManager = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(
  packageManager,
  ['run', 'test:server:files', ...testFiles],
  { stdio: 'inherit' },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
