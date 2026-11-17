const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const path = require('node:path');
const test = require('node:test');

const fromVite = createRequire(require.resolve('vite/package.json'));
const fromNunjucks = createRequire(require.resolve('nunjucks/package.json'));
const fromChokidar = createRequire(fromNunjucks.resolve('chokidar'));
const fromAnymatch = createRequire(fromChokidar.resolve('anymatch'));
const installations = [fromAnymatch, fromVite].map(resolve =>
  path.dirname(resolve.resolve('picomatch')),
);

assert.deepEqual(
  [
    ...new Set(
      installations.map(
        directory => require(`${directory}/package.json`).version,
      ),
    ),
  ].sort(),
  ['2.3.2', '4.0.7'],
  'Exercise both resolved picomatch release lines',
);

for (const directory of installations) {
  const picomatch = require(directory);
  const version = require(`${directory}/package.json`).version;

  test(`picomatch ${version} keeps wildcard repetition bounded`, () => {
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        `
        const assert = require('node:assert/strict');
        const pm = require(process.argv[1]);
        for (const pattern of ['+(*)', '+(*a)', '*(a*)', '+(*?a)', '+(@(*a))', '+(*(?!b)a)', '+(*(?:a)a)', '+([*a)', 'prefix+(*a).txt']) {
          assert(!pm(pattern)('a'.repeat(60) + '!'), pattern);
          assert(pm(pattern)(pattern), pattern + ' uses literal fallback');
        }
        assert(!pm('+([*a)', {})('[a'.repeat(60) + '!'));
        assert(!pm('+([*a])', { nobracket: true })('[a]'.repeat(60) + '!'));
        assert(pm('+([*a])', { nobracket: true })('+([*a])'));
      `,
        directory,
      ],
      { timeout: 3000, encoding: 'utf8' },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
  });

  test(`picomatch ${version} preserves ordinary glob matching`, () => {
    for (const [pattern, subject] of [
      ['**/*.{js,ts}', 'modules/core/client/example.ts'],
      ['+(abc)', 'abcabc'],
      ['*(foo|bar)', 'foobarfoo'],
      ['+(\\*)', '***'],
      ['+([*])', '***'],
      ['+("*")', '***'],
      ['+(*(a))', 'aaaa'],
    ]) {
      assert(picomatch(pattern)(subject), `${pattern} matches ${subject}`);
    }
    assert(!picomatch('**/*.js')('example.css'));
    assert(picomatch('+(*a)', { noextglob: true })('+(*a)'));
    assert(!picomatch('+(*a)', { noextglob: true })('aaaa'));
  });
}
