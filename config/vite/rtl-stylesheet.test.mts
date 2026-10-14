import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  rtlStylesheetPlugin,
  type RtlStylesheetAsset,
  type RtlStylesheetBundle,
  type RtlStylesheetPlugin,
  type RtlStylesheetPluginContext,
} from './rtl-stylesheet.mjs';

function runPlugin(bundle: RtlStylesheetBundle): RtlStylesheetAsset[] {
  const plugin = rtlStylesheetPlugin() as RtlStylesheetPlugin;
  const hook = plugin.generateBundle;
  const emitted: RtlStylesheetAsset[] = [];
  const context = {
    error(message: string): never {
      throw new Error(message);
    },
    emitFile(file: RtlStylesheetAsset) {
      emitted.push(file);
      return String(emitted.length);
    },
  } satisfies RtlStylesheetPluginContext;
  hook.call(context, {}, bundle);
  return emitted;
}

test('emits a flipped react-main.rtl.css asset', () => {
  const bundle: RtlStylesheetBundle = {
    'react-main.css': {
      type: 'asset',
      fileName: 'react-main.css',
      source: '.box{margin-left:1px;float:left}',
    },
  };
  const [stylesheet] = runPlugin(bundle);

  assert(stylesheet !== undefined);
  assert(typeof stylesheet.source === 'string');
  assert.equal(stylesheet.fileName, 'react-main.rtl.css');
  assert.match(stylesheet.source, /margin-right:\s*1px/);
  assert.match(stylesheet.source, /float:\s*right/);
  assert.doesNotMatch(stylesheet.source, /margin-left/);
  assert.doesNotMatch(stylesheet.source, /float:\s*left/);
});

test('refuses to emit RTL CSS without the production stylesheet', () => {
  assert.throws(() => runPlugin({}), /Expected one react-main\.css asset/);
});
