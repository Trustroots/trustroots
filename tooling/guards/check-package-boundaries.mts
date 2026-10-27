#!/usr/bin/env node
/**
 * Keep shared packages independent of application code. Imports between shared
 * packages are allowed only when the importing package declares the dependency.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  inside,
  listPackages,
  listSourceFiles,
  resolveSpecifier,
  sourceSpecifiers,
  type SourcePackage,
} from './source-imports.mts';

export type Violation = {
  file: string;
  specifier: string;
  message: string;
};

function invalidPackageDirectories(root: string): string[] {
  const packagesDir = path.join(root, 'packages');
  if (!fs.existsSync(packagesDir)) return [];
  return fs.readdirSync(packagesDir, { withFileTypes: true }).flatMap(entry => {
    const dir = path.join(packagesDir, entry.name);
    let isDirectory = entry.isDirectory();
    if (entry.isSymbolicLink()) {
      try {
        isDirectory = fs.statSync(dir).isDirectory();
      } catch {
        isDirectory = false;
      }
    }
    if (!isDirectory) return [];

    const hasProductionSource = listSourceFiles(dir).length > 0;
    if (!hasProductionSource) return [];
    if (entry.isSymbolicLink()) return [dir];

    const invalidManifest = (() => {
      const manifestFile = path.join(dir, 'package.json');
      if (!fs.existsSync(manifestFile)) return true;
      try {
        const manifest = JSON.parse(
          fs.readFileSync(manifestFile, 'utf8'),
        ) as Record<string, unknown>;
        return typeof manifest.name !== 'string';
      } catch {
        return true;
      }
    })();
    return invalidManifest ? [dir] : [];
  });
}

function declaredWorkspaceDependency(
  pkg: SourcePackage,
  target: SourcePackage,
): boolean {
  for (const field of [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    const deps = pkg.manifest[field];
    if (
      deps &&
      typeof deps === 'object' &&
      (deps as Record<string, unknown>)[target.name] === 'workspace:*'
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
  const sharedPackages = packages.filter(pkg =>
    inside(path.join(root, 'packages'), pkg.dir),
  );
  const violations: Violation[] = [];

  for (const dir of invalidPackageDirectories(root)) {
    violations.push({
      file: `${path.relative(root, dir).split(path.sep).join('/')}/package.json`,
      specifier: 'package.json',
      message: fs.lstatSync(dir).isSymbolicLink()
        ? 'Shared package production source cannot live under a symlinked package directory.'
        : 'Shared package production source requires a valid manifest with a package name.',
    });
  }

  for (const pkg of sharedPackages) {
    for (const entry of listSourceFiles(pkg.dir)) {
      const file = entry.file;
      if (entry.symlink) {
        violations.push({
          file: path.relative(root, file).split(path.sep).join('/'),
          specifier: '<symlink>',
          message:
            'Shared package production source cannot be a symlink; move the source into the package.',
        });
        continue;
      }
      for (const specifier of sourceSpecifiers(file)) {
        const result = resolveSpecifier(specifier, file, root, packages);
        if (!result) continue;

        let message: string | undefined;
        if (result.invalidInternal) {
          message =
            'Unrecognised or out-of-repository import from a shared package.';
        } else if (result.target && !inside(pkg.dir, result.target.dir)) {
          if (!inside(path.join(root, 'packages'), result.target.dir)) {
            message = `Shared packages cannot import ${result.target.name}.`;
          } else if (!declaredWorkspaceDependency(pkg, result.target)) {
            message = `Declare ${result.target.name} as a workspace:* dependency before importing it.`;
          }
        } else if (result.resolved && !inside(pkg.dir, result.resolved)) {
          message =
            'Shared packages cannot import repository files outside their own package.';
        }

        if (message) {
          violations.push({
            file: path.relative(root, file).split(path.sep).join('/'),
            specifier,
            message,
          });
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
      `Shared package boundary violations:\n${violations
        .map(
          ({ file, specifier, message }) =>
            `  ${file}: ${specifier} — ${message}`,
        )
        .join('\n')}`,
    );
    return 1;
  }
  console.log('Shared package boundaries are satisfied.');
  return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
