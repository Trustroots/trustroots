#!/usr/bin/env node
/** Prevent production feature modules from importing upward into apps or layers. */
import fs from 'node:fs';
import path from 'node:path';
import {
  inside,
  listPackages,
  listSourceFiles,
  resolveSpecifier,
  sourceSpecifiers,
} from './source-imports.mts';

export type Violation = {
  file: string;
  specifier: string;
  message: string;
};

type ModuleDirectory = { dir: string; symlink: boolean };

function listModuleDirectories(root: string): ModuleDirectory[] {
  const modulesDir = path.join(root, 'modules');
  if (!fs.existsSync(modulesDir)) return [];
  const result: ModuleDirectory[] = [];
  for (const entry of fs.readdirSync(modulesDir, { withFileTypes: true })) {
    const dir = path.join(modulesDir, entry.name);
    if (entry.isDirectory()) {
      result.push({ dir, symlink: false });
      continue;
    }
    if (entry.isSymbolicLink()) {
      try {
        if (fs.statSync(dir).isDirectory()) result.push({ dir, symlink: true });
      } catch {
        // Broken links cannot contain production source.
      }
    }
  }
  return result;
}

function isUpwardTarget(
  result: ReturnType<typeof resolveSpecifier>,
  root: string,
): boolean {
  if (!result) return false;
  for (const group of ['layers', 'apps']) {
    const groupDir = path.join(root, group);
    if (
      (result.target && inside(groupDir, result.target.dir)) ||
      (result.resolved && inside(groupDir, result.resolved)) ||
      (result.lexical && inside(groupDir, result.lexical))
    ) {
      return true;
    }
  }
  return false;
}

export function analyze(
  root = path.resolve(import.meta.dirname, '../..'),
): Violation[] {
  root = fs.realpathSync(path.resolve(root));
  const packages = listPackages(root);
  const violations: Violation[] = [];

  for (const module of listModuleDirectories(root)) {
    const moduleLabel = path
      .relative(root, module.dir)
      .split(path.sep)
      .join('/');
    for (const tier of ['client', 'server', 'shared']) {
      const tierDir = path.join(module.dir, tier);
      if (!fs.existsSync(tierDir)) continue;

      const sources = listSourceFiles(tierDir);
      if (module.symlink && sources.length > 0) {
        violations.push({
          file: moduleLabel,
          specifier: '<symlink>',
          message:
            'Production module source cannot live under a symlinked module directory.',
        });
        break;
      }

      for (const entry of sources) {
        const file = entry.file;
        const relativeFile = path
          .relative(root, file)
          .split(path.sep)
          .join('/');
        if (entry.symlink) {
          violations.push({
            file: relativeFile,
            specifier: '<symlink>',
            message: 'Production module source cannot be a symlink.',
          });
          continue;
        }

        for (const specifier of sourceSpecifiers(file)) {
          const result = resolveSpecifier(specifier, file, root, packages);
          if (isUpwardTarget(result, root)) {
            violations.push({
              file: relativeFile,
              specifier,
              message:
                'Feature modules cannot import application or layer code.',
            });
          } else if (result?.invalidInternal) {
            violations.push({
              file: relativeFile,
              specifier,
              message:
                'Feature modules cannot import unknown internal or out-of-repository paths.',
            });
          }
        }
      }
    }
  }

  return violations.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.specifier.localeCompare(b.specifier) ||
      a.message.localeCompare(b.message),
  );
}

export function main(
  _argv: string[],
  root = path.resolve(import.meta.dirname, '../..'),
): number {
  const violations = analyze(root);
  if (violations.length) {
    console.error(
      `Feature module boundary violations:\n${violations
        .map(
          ({ file, specifier, message }) =>
            `  ${file}: ${specifier} — ${message}`,
        )
        .join('\n')}`,
    );
    return 1;
  }
  console.log('Feature module boundaries are satisfied.');
  return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
