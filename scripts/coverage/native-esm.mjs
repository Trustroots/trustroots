import { registerHooks, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { createInstrumenter } = require('istanbul-lib-instrument');
const glob = require('glob');
const config = JSON.parse(
  readFileSync(new URL('../../.nycrc-server', import.meta.url), 'utf8'),
);
const root = path.resolve(import.meta.dirname, '../..');
// Test subprocesses can run from temporary fixture directories.
if (process.env.NODE_OPTIONS) {
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS.replace(
    '--import ./scripts/coverage/native-esm.mjs',
    `--import ${import.meta.url}`,
  );
}
const instrumenter = createInstrumenter({ esModules: true });
const sources = new Map();

// Seed every eligible implementation, including files the test run never loads.
// NYC's CommonJS require hook cannot safely instrument native require(ESM).
globalThis.__coverage__ = globalThis.__coverage__ || {};
for (const pattern of config.include) {
  for (const relative of glob.sync(pattern, { cwd: root })) {
    if (config.exclude.some(excluded => path.matchesGlob(relative, excluded)))
      continue;
    const filename = path.join(root, relative);
    const source = instrumenter.instrumentSync(
      readFileSync(filename, 'utf8'),
      filename,
    );
    sources.set(filename, source);
    const coverage = instrumenter.lastFileCoverage();
    if (coverage) globalThis.__coverage__[filename] = coverage;
  }
}

registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (result.format !== 'module' || !url.startsWith('file:')) return result;
    const filename = fileURLToPath(url);
    if (!sources.has(filename)) return result;
    return { ...result, source: sources.get(filename) };
  },
});
