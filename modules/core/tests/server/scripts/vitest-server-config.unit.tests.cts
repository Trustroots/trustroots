const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const {
  execFileSync,
}: typeof import('node:child_process') = require('node:child_process');
const path: typeof import('node:path') = require('node:path');

const root = path.resolve(__dirname, '../../../../..');

function include(serverTestFiles: string) {
  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      "const { default: config } = await import('./vitest.server.config.mts');" +
        'console.log(JSON.stringify(config.test.include));',
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        NODE_OPTIONS: '',
        SERVER_TEST_FILES: serverTestFiles,
      },
      encoding: 'utf8',
    },
  );
  return JSON.parse(output.trim().split('\n').pop()!) as string[];
}

describe('Vitest server config', () => {
  it('runs every server test file when SERVER_TEST_FILES is empty', () => {
    assert.deepEqual(include(''), ['modules/*/tests/server/**/*.{js,cts,mts}']);
  });

  it('runs only the listed files when SERVER_TEST_FILES is set', () => {
    assert.deepEqual(include('modules/a.cts,,modules/b.cts'), [
      'modules/a.cts',
      'modules/b.cts',
    ]);
  });
});
