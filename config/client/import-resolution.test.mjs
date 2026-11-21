import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { test } from 'node:test';
import aliasesConfig from './aliases.mts';

test('bundler package aliases are real CommonJS entry files', () => {
  for (const filename of Object.values(aliasesConfig.commonJsAliases)) {
    assert.equal(existsSync(filename), true, filename);
    assert.equal(dirname(filename).includes('node_modules'), true, filename);
  }
});
