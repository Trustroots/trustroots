#!/usr/bin/env node
/** Prevent production module source from crossing client/server/shared tiers. */
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

type RuntimeTier = 'client' | 'server' | 'shared';
const TIERS: RuntimeTier[] = ['client', 'server', 'shared'];

function tierAtPath(
  moduleDir: string,
  target: string,
): RuntimeTier | undefined {
  if (!inside(moduleDir, target)) return undefined;
  const first = path.relative(moduleDir, target).split(path.sep)[0];
  return TIERS.find(tier => tier === first);
}

function targetTier(
  specifier: string,
  result: ReturnType<typeof resolveSpecifier>,
): RuntimeTier | undefined {
  if (!result) return undefined;
  if (
    result.target &&
    result.target.dir.includes(`${path.sep}modules${path.sep}`)
  ) {
    const suffix = specifier
      .slice(result.target.name.length)
      .replace(/^\//, '');
    const first = suffix.split('/')[0];
    if (TIERS.includes(first as RuntimeTier)) return first as RuntimeTier;
  }
  if (result.resolved && result.target) {
    return tierAtPath(result.target.dir, result.resolved);
  }
  return undefined;
}

function forbidden(source: RuntimeTier, target: RuntimeTier): boolean {
  return (
    (source === 'client' && target === 'server') ||
    (source === 'server' && target === 'client') ||
    (source === 'shared' && (target === 'client' || target === 'server'))
  );
}

export function analyze(
  root = path.resolve(import.meta.dirname, '../..'),
): Violation[] {
  root = fs.realpathSync(path.resolve(root));
  const packages = listPackages(root);
  const violations: Violation[] = [];
  const modulesDir = path.join(root, 'modules');
  if (!fs.existsSync(modulesDir)) return violations;

  for (const entry of fs.readdirSync(modulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const moduleDir = path.join(modulesDir, entry.name);
    for (const sourceTier of TIERS) {
      const sourceDir = path.join(moduleDir, sourceTier);
      if (!fs.existsSync(sourceDir)) continue;
      for (const source of listSourceFiles(sourceDir)) {
        if (source.symlink) continue; // The module boundary guard diagnoses it.
        const file = path.relative(root, source.file).split(path.sep).join('/');
        for (const specifier of sourceSpecifiers(source.file)) {
          const result = resolveSpecifier(
            specifier,
            source.file,
            root,
            packages,
          );
          const importedTier = targetTier(specifier, result);
          if (importedTier && forbidden(sourceTier, importedTier)) {
            violations.push({
              file,
              specifier,
              message: `Module ${sourceTier} source cannot import ${importedTier} source.`,
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
      `Module runtime boundary violations:\n${violations
        .map(
          ({ file, specifier, message }) =>
            `  ${file}: ${specifier} — ${message}`,
        )
        .join('\n')}`,
    );
    return 1;
  }
  console.log('Module runtime boundaries are satisfied.');
  return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
