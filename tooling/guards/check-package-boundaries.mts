#!/usr/bin/env node
/**
 * Keep shared packages independent of application code. Imports between shared
 * packages are allowed only when the importing package declares the dependency.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export type Violation = {
  file: string;
  specifier: string;
  message: string;
};

type PackageInfo = {
  name: string;
  dir: string;
  manifest: Record<string, unknown>;
};

type SourceEntry = { file: string; symlink: boolean };

const SOURCE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
]);
const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  'test',
  'tests',
  '__tests__',
]);
const REPOSITORY_ROOTS = [
  'packages',
  'modules',
  'apps',
  'layers',
  'config',
  'tooling',
];

function inside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
}

function listPackages(root: string): PackageInfo[] {
  const result: PackageInfo[] = [];
  for (const group of ['packages', 'modules', 'apps', 'layers']) {
    const groupDir = path.join(root, group);
    if (!fs.existsSync(groupDir)) continue;
    for (const entry of fs.readdirSync(groupDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(groupDir, entry.name);
      const manifestFile = path.join(dir, 'package.json');
      if (!fs.existsSync(manifestFile)) continue;
      try {
        const manifest = JSON.parse(
          fs.readFileSync(manifestFile, 'utf8'),
        ) as Record<string, unknown>;
        if (typeof manifest.name === 'string') {
          result.push({ name: manifest.name, dir, manifest });
        }
      } catch {
        // Invalid manifests are reported by the package manager; they cannot
        // contribute a usable internal package name here.
      }
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

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

function listSourceFiles(dir: string): SourceEntry[] {
  const files: SourceEntry[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      // Ignore conventional test and generated directories before treating a
      // symlink as a source-tree escape.
      if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue;
      let isDirectory = false;
      try {
        isDirectory = fs.statSync(full).isDirectory();
      } catch {
        // A broken source symlink is still rejected below when it has a source
        // extension; a broken directory symlink cannot contain source files.
      }
      if (isDirectory) {
        files.push({ file: full, symlink: true });
      } else if (
        SOURCE_EXTENSIONS.has(path.extname(entry.name)) &&
        !/\.(?:test|tests|spec)\.[^.]+$/.test(entry.name)
      ) {
        files.push({ file: full, symlink: true });
      }
      continue;
    }
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && !IGNORED_DIRS.has(entry.name)) {
        files.push(...listSourceFiles(full));
      }
    } else if (
      entry.isFile() &&
      SOURCE_EXTENSIONS.has(path.extname(entry.name))
    ) {
      if (!/\.(?:test|tests|spec)\.[^.]+$/.test(entry.name)) {
        files.push({ file: full, symlink: false });
      }
    }
  }
  return files;
}

function literalText(node: ts.Node | undefined): string | undefined {
  if (
    node &&
    (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node))
  ) {
    return node.text;
  }
  return undefined;
}

function sourceSpecifiers(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  const add = (node: ts.Node | undefined) => {
    const value = literalText(node);
    if (value !== undefined) specifiers.push(value);
  };

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    ) {
      add(node.moduleSpecifier);
    } else if (ts.isImportTypeNode(node)) {
      if (ts.isLiteralTypeNode(node.argument)) add(node.argument.literal);
    } else if (ts.isExternalModuleReference(node)) {
      add(node.expression);
    } else if (ts.isCallExpression(node)) {
      const name = node.expression.getText(source);
      if (
        name === 'require' ||
        name === 'module.require' ||
        name === 'import' ||
        name === 'require.resolve'
      ) {
        add(node.arguments[0]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

function packageForPath(
  file: string,
  packages: PackageInfo[],
): PackageInfo | undefined {
  return packages
    .filter(pkg => inside(pkg.dir, file))
    .sort((a, b) => b.dir.length - a.dir.length)[0];
}

function canonicalPath(target: string): string {
  let existing = target;
  const missing: string[] = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) return path.resolve(target);
    missing.unshift(path.basename(existing));
    existing = parent;
  }
  return path.resolve(fs.realpathSync(existing), ...missing);
}

function declaredWorkspaceDependency(
  pkg: PackageInfo,
  target: PackageInfo,
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

function resolveSpecifier(
  specifier: string,
  file: string,
  root: string,
  packages: PackageInfo[],
):
  | { target?: PackageInfo; resolved?: string; invalidInternal?: boolean }
  | undefined {
  const namedPackage = packages.find(
    pkg => specifier === pkg.name || specifier.startsWith(`${pkg.name}/`),
  );
  if (namedPackage) return { target: namedPackage };
  if (specifier.startsWith('@trustroots/')) return { invalidInternal: true };

  let resolved: string | undefined;
  if (specifier.startsWith('file:')) {
    try {
      resolved = fileURLToPath(specifier);
    } catch {
      return { invalidInternal: true };
    }
  } else if (specifier.startsWith('@/')) {
    resolved = path.resolve(root, specifier.slice(2));
  } else if (specifier.startsWith('~modules/')) {
    resolved = path.resolve(
      root,
      'modules',
      specifier.slice('~modules/'.length),
    );
  } else if (
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    specifier === '.' ||
    specifier === '..'
  ) {
    resolved = path.resolve(path.dirname(file), specifier);
  } else if (path.isAbsolute(specifier)) {
    resolved = path.resolve(specifier);
  } else {
    const rootPath = REPOSITORY_ROOTS.find(
      prefix => specifier === prefix || specifier.startsWith(`${prefix}/`),
    );
    if (rootPath) resolved = path.resolve(root, specifier);
  }

  if (!resolved) return undefined;
  const canonical = canonicalPath(resolved);
  const target = packageForPath(canonical, packages);
  if (target) return { target, resolved: canonical };
  if (!inside(root, canonical))
    return { invalidInternal: true, resolved: canonical };
  if (inside(path.join(root, 'packages'), canonical))
    return { invalidInternal: true, resolved: canonical };
  return { resolved: canonical };
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
