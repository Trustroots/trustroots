import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

function check(t: TestContext, source: string): SpawnSyncReturns<string> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'internal-links-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const shell = path.join(root, 'layers/shell/client');
  const routes = path.join(shell, 'routes');
  fs.mkdirSync(routes, { recursive: true });
  fs.writeFileSync(
    path.join(routes, 'profile.edit.account.tsx'),
    `
    import Account from '../Account';
    export const Route = createRoute(routeOptions('/profile/edit/account', () => <Account />));
  `,
  );
  fs.writeFileSync(
    path.join(routes, 'faq.index.tsx'),
    `
    import Faq from '@/modules/pages/client/Faq';
    export const Route = createRoute(routeOptions('/faq', () => <Faq />));
  `,
  );
  fs.writeFileSync(
    path.join(shell, 'Account.tsx'),
    `import Child from './Child'; export default () => <div id="remove"><Child /></div>;`,
  );
  fs.writeFileSync(
    path.join(shell, 'Child.tsx'),
    `export default () => <div id="nested" />;`,
  );
  fs.writeFileSync(
    path.join(shell, 'ReactAppShell.tsx'),
    `export default () => <main id="tr-main" />;`,
  );
  const pages = path.join(root, 'modules/pages/client');
  fs.mkdirSync(pages, { recursive: true });
  fs.writeFileSync(path.join(pages, 'Faq.tsx'), source);
  return spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL('./check-internal-links.mts', import.meta.url)),
      root,
    ],
    { encoding: 'utf8' },
  );
}

test('accepts known routes, fragments, queries and external links', t => {
  const result = check(
    t,
    `<>
    <a href={'/profile/edit/account#remove'} />
    <a href="/profile/edit/account#nested" />
    <a href="#tr-main" />
    <a href="/faq?query=hello" />
    <a href="https://www.trustroots.org/profile/edit/account#remove" />
    <a href="https://example.test/missing#fragment" />
    <a href="mailto:hello@example.test" />
    <a href="/api/users/export" />
    <div id="local" /><a href="#local" />
  </>`,
  );
  assert.equal(result.status, 0, result.stderr);
});

test('reports stale routes and missing fragments in their source file', t => {
  const result = check(
    t,
    `<>
    <a href="/profile-edit/account#remove" />
    <a href="/profile/edit/account#missing" />
    <a href="/faq#remove" />
    <a href="#missing" />
    <a href="faq.general" />
  </>`,
  );
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Faq.tsx:2: \/profile-edit\/account#remove \(unknown route\)/,
  );
  assert.match(
    result.stderr,
    /\/profile\/edit\/account#missing \(missing fragment\)/,
  );
  assert.match(result.stderr, /\/faq#remove \(missing fragment\)/);
  assert.match(result.stderr, /#missing \(missing fragment\)/);
  assert.match(result.stderr, /faq.general \(relative browser route/);
});
