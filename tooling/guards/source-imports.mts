/** Shared source-import scanning and repository path resolution for guards. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export type SourcePackage = {
  name: string;
  dir: string;
  manifest: Record<string, unknown>;
};

export type SourceEntry = { file: string; symlink: boolean };

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

export function inside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
}

export function listPackages(root: string): SourcePackage[] {
  const result: SourcePackage[] = [];
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

export function listSourceFiles(dir: string): SourceEntry[] {
  const files: SourceEntry[] = [];
  let rootIsSymlink = false;
  try {
    rootIsSymlink = fs.lstatSync(dir).isSymbolicLink();
  } catch {
    return files;
  }
  if (rootIsSymlink) return [{ file: dir, symlink: true }];

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
        // A broken source symlink is still rejected below when its extension
        // identifies it as source; a broken directory link contains no source.
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

export function sourceSpecifiers(file: string): string[] {
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
  packages: SourcePackage[],
): SourcePackage | undefined {
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

export type ResolvedSpecifier = {
  target?: SourcePackage;
  lexical?: string;
  resolved?: string;
  invalidInternal?: boolean;
};

export function resolveSpecifier(
  specifier: string,
  file: string,
  root: string,
  packages: SourcePackage[],
): ResolvedSpecifier | undefined {
  const namedPackage = packages
    .filter(
      pkg => specifier === pkg.name || specifier.startsWith(`${pkg.name}/`),
    )
    .sort((a, b) => b.name.length - a.name.length)[0];
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
  if (target) return { target, lexical: resolved, resolved: canonical };
  if (!inside(root, canonical))
    return { invalidInternal: true, lexical: resolved, resolved: canonical };
  if (inside(path.join(root, 'packages'), canonical))
    return { invalidInternal: true, lexical: resolved, resolved: canonical };
  return { lexical: resolved, resolved: canonical };
}
