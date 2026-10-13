import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

function check(t, source) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'internal-links-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const routes = path.join(root, 'modules/core/client/react-app');
  fs.mkdirSync(routes, { recursive: true });
  fs.writeFileSync(
    path.join(routes, 'routes.tsx'),
    `
    import Account from './Account';
    import Faq from './Faq';
    const routes = {
      '/profile/edit/account': () => <Account />,
      '/faq': () => <Faq />,
    };
  `,
  );
  fs.writeFileSync(
    path.join(routes, 'Account.tsx'),
    `import Child from './Child'; export default () => <div id="remove"><Child /></div>;`,
  );
  fs.writeFileSync(
    path.join(routes, 'Child.tsx'),
    `export default () => <div id="nested" />;`,
  );
  fs.writeFileSync(
    path.join(routes, 'ReactAppShell.tsx'),
    `export default () => <main id="tr-main" />;`,
  );
  fs.writeFileSync(path.join(routes, 'Faq.tsx'), source);
  return spawnSync(
    process.execPath,
    [new URL('./check-internal-links.mjs', import.meta.url).pathname, root],
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
