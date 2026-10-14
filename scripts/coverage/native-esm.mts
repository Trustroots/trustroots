import { registerHooks, createRequire, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { globSync, readFileSync } from 'node:fs';

declare global {
  var __coverage__: Record<string, unknown> | undefined;
}

interface Instrumenter {
  instrumentSync(source: string, filename: string): string;
  lastFileCoverage(): unknown;
}

const require = createRequire(import.meta.url);
const { createInstrumenter } = require(
  'istanbul-lib-instrument',
) as {
  createInstrumenter(options: { esModules: boolean }): Instrumenter;
};
const config = JSON.parse(
  readFileSync(new URL('../../.nycrc-server', import.meta.url), 'utf8'),
) as { include: string[]; exclude: string[] };
const root = path.resolve(import.meta.dirname, '../..');
// Test subprocesses can run from temporary fixture directories.
if (process.env.NODE_OPTIONS) {
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS.replace(
    '--import ./scripts/coverage/native-esm.mts',
    `--import ${import.meta.url}`,
  );
}
const instrumenter = createInstrumenter({ esModules: true });
const sources = new Map<string, string>();

// Strip mode blanks type syntax with spaces, so line and column positions in
// the coverage report still match the TypeScript source.
const readSource = (filename: string): string => {
  const source = readFileSync(filename, 'utf8');
  return filename.endsWith('.mts')
    ? stripTypeScriptTypes(source, { mode: 'strip' })
    : source;
};

// Seed every eligible implementation, including files the test run never loads.
// NYC's CommonJS require hook cannot safely instrument native require(ESM).
globalThis.__coverage__ = globalThis.__coverage__ || {};
for (const pattern of config.include) {
  for (const relative of globSync(pattern, { cwd: root }).sort()) {
    if (config.exclude.some(excluded => path.matchesGlob(relative, excluded)))
      continue;
    const filename = path.join(root, relative);
    const source = instrumenter.instrumentSync(
      readSource(filename),
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
    if (
      (result.format !== 'module' && result.format !== 'module-typescript') ||
      !url.startsWith('file:')
    )
      return result;
    const filename = fileURLToPath(url);
    if (!sources.has(filename)) return result;
    return { ...result, format: 'module', source: sources.get(filename) };
  },
});
