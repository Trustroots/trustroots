import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rtlStylesheetPlugin } from './rtl-stylesheet.mjs';

function runPlugin(bundle) {
  const plugin = rtlStylesheetPlugin();
  const emitted = [];
  plugin.generateBundle.call(
    {
      error(message) {
        throw new Error(message);
      },
      emitFile(file) {
        emitted.push(file);
      },
    },
    {},
    bundle,
  );
  return emitted;
}

test('emits a flipped react-main.rtl.css asset', () => {
  const [stylesheet] = runPlugin({
    'react-main.css': {
      type: 'asset',
      fileName: 'react-main.css',
      source: '.box{margin-left:1px;float:left}',
    },
  });

  assert.equal(stylesheet.fileName, 'react-main.rtl.css');
  assert.match(stylesheet.source, /margin-right:\s*1px/);
  assert.match(stylesheet.source, /float:\s*right/);
  assert.doesNotMatch(stylesheet.source, /margin-left/);
  assert.doesNotMatch(stylesheet.source, /float:\s*left/);
});

test('refuses to emit RTL CSS without the production stylesheet', () => {
  assert.throws(() => runPlugin({}), /Expected one react-main\.css asset/);
});
