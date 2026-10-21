#!/usr/bin/env node
/**
 * Keeps `modules/<name>/package.json` in step with the code: every module is a
 * private, source-only workspace package whose `workspace:*` dependencies are
 * the links recorded in `module-graph-baseline.json`.
 *
 *   node scripts/ci/check-module-packages.mts            check the manifests
 *   node scripts/ci/check-module-packages.mts --update   rewrite them
 */
import fs from 'node:fs';
import path from 'node:path';

type Graph = Record<string, string[]>;
type Manifest = {
  name: string;
  version: string;
  private: true;
  type: 'module';
  exports: Record<string, string>;
  scripts: Record<string, string>;
  dependencies?: Record<string, string>;
};

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SOURCE_EXTENSIONS = '.js,.mjs,.mts,.cjs,.cts,.ts,.tsx';

function listModules(root: string): string[] {
  return fs
    .readdirSync(path.join(root, 'modules'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

function hasDir(root: string, ...parts: string[]): boolean {
  return fs.existsSync(path.join(root, ...parts));
}

function linkedModules(name: string, root: string): string[] {
  const baseline: { imports?: Graph; models?: Graph } = JSON.parse(
    fs.readFileSync(path.join(root, 'module-graph-baseline.json'), 'utf8'),
  );
  return [
    ...new Set([
      ...(baseline.imports?.[name] || []),
      ...(baseline.models?.[name] || []),
    ]),
  ].sort();
}

const UI_PACKAGE = '@trustroots/ui';
const UI_IMPORT = /from\s+['"]@trustroots\/ui['"]/;

function importsUiPackage(name: string, root: string): boolean {
  return fs
    .globSync(
      `{client,shared,tests}/**/*.{${SOURCE_EXTENSIONS.replaceAll('.', '')}}`,
      { cwd: path.join(root, 'modules', name) },
    )
    .some(file =>
      UI_IMPORT.test(
        fs.readFileSync(path.join(root, 'modules', name, file), 'utf8'),
      ),
    );
}

export function expectedManifest(name: string, root = ROOT): Manifest {
  const dir = ['modules', name];
  const exports: Record<string, string> = {};
  ['client', 'shared'].forEach(folder => {
    if (hasDir(root, ...dir, folder)) {
      exports[`./${folder}/*`] = `./${folder}/*`;
    }
  });

  const scripts: Record<string, string> = {
    lint: `eslint --ext ${SOURCE_EXTENSIONS} .`,
  };
  if (hasDir(root, ...dir, 'tests', 'client')) {
    scripts['test:client'] =
      `node ../../scripts/test-module.cts client ${name}`;
  }
  if (hasDir(root, ...dir, 'tests', 'server')) {
    scripts['test:server'] =
      `node ../../scripts/test-module.cts server ${name}`;
  }

  const manifest: Manifest = {
    name: `@trustroots/${name}`,
    version: '0.0.0',
    private: true,
    type: 'module',
    exports,
    scripts,
  };
  const dependencies = linkedModules(name, root).map(
    link => `@trustroots/${link}`,
  );
  if (importsUiPackage(name, root)) dependencies.push(UI_PACKAGE);
  if (dependencies.length) {
    manifest.dependencies = Object.fromEntries(
      dependencies.sort().map(dependency => [dependency, 'workspace:*']),
    );
  }
  return manifest;
}

export function main(argv: string[], root = ROOT): number {
  const update = argv.includes('--update');
  const stale: string[] = [];

  listModules(root).forEach(name => {
    const file = path.join(root, 'modules', name, 'package.json');
    const expected = `${JSON.stringify(expectedManifest(name, root), null, 2)}\n`;
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === expected) {
      return;
    }
    if (update) {
      fs.writeFileSync(file, expected);
    } else {
      stale.push(`modules/${name}/package.json`);
    }
  });

  if (stale.length) {
    console.error(
      `Module package manifests out of date:\n${stale
        .map(file => `  ${file}`)
        .join('\n')}\nRun \`pnpm run modules:update-packages\`.`,
    );
    return 1;
  }
  console.log(
    update
      ? 'Wrote module package manifests.'
      : 'Module package manifests match the module graph baseline.',
  );
  return 0;
}

if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2));
}
