import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { getReactRoutePolicy } from '../../modules/core/shared/react-route-ownership.mts';

const root = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const records = new Map();

function resolveSource(from, specifier) {
  const base = specifier.startsWith('@/')
    ? path.join(root, specifier.slice(2))
    : specifier.startsWith('.')
    ? path.resolve(path.dirname(from), specifier)
    : null;
  if (!base) return null;
  const stem = base.replace(/\.[cm]?[jt]sx?$/, '');
  return [
    base,
    ...['.tsx', '.ts', '.mts', '.js', '/index.tsx', '/index.ts'].map(
      ext => stem + ext,
    ),
  ].find(
    candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
  );
}

function literal(node) {
  if (node && ts.isJsxExpression(node)) return literal(node.expression);
  return node &&
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null;
}

function readSource(file) {
  if (records.has(file)) return records.get(file);
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const record = {
    source,
    ids: new Set(),
    links: [],
    imports: new Map(),
    declarations: new Map(),
  };
  records.set(file, record);
  function visit(node) {
    // Some sections are generated from objects with literal id fields.
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'id') {
      const value = literal(node.initializer);
      if (value !== null) record.ids.add(value);
    }
    if (ts.isJsxAttribute(node)) {
      const value = literal(node.initializer);
      if (value !== null && node.name.text === 'id') record.ids.add(value);
      if (value !== null && node.name.text === 'href') {
        record.links.push({
          href: value,
          line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        });
      }
    }
    if (
      ts.isImportDeclaration(node) &&
      !node.importClause?.isTypeOnly &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const imported = resolveSource(file, node.moduleSpecifier.text);
      if (imported) {
        const clause = node.importClause;
        if (clause?.name) record.imports.set(clause.name.text, imported);
        if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          clause.namedBindings.elements
            .filter(binding => !binding.isTypeOnly)
            .forEach(binding =>
              record.imports.set(binding.name.text, imported),
            );
        }
      }
    }
    if (
      (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) &&
      node.name &&
      ts.isIdentifier(node.name)
    ) {
      record.declarations.set(node.name.text, node);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return record;
}

function importedFiles(record, node, seen = new Set()) {
  const files = new Set();
  function visit(child) {
    if (ts.isIdentifier(child)) {
      const name = child.text;
      if (record.imports.has(name)) files.add(record.imports.get(name));
      if (!seen.has(name) && record.declarations.has(name)) {
        seen.add(name);
        visit(record.declarations.get(name));
      }
    }
    ts.forEachChild(child, visit);
  }
  visit(node);
  return files;
}

function collectIds(files, seen = new Set()) {
  const ids = new Set();
  for (const file of files) {
    if (seen.has(file)) continue;
    seen.add(file);
    const record = readSource(file);
    record.ids.forEach(id => ids.add(id));
    collectIds(record.imports.values(), seen).forEach(id => ids.add(id));
  }
  return ids;
}

function clientFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? clientFiles(file)
      : /\.[jt]sx?$/.test(file)
      ? [file]
      : [];
  });
}

const routesFile = readSource(
  path.join(root, 'modules/core/client/react-app/routes.tsx'),
);
const routeIds = new Map();
function findRoutes(node) {
  if (
    ts.isPropertyAssignment(node) &&
    ts.isStringLiteral(node.name) &&
    node.name.text.startsWith('/')
  ) {
    routeIds.set(
      node.name.text,
      collectIds(importedFiles(routesFile, node.initializer)),
    );
  }
  ts.forEachChild(node, findRoutes);
}
findRoutes(routesFile.source);

const errors = [];
const shellFile = path.join(
  root,
  'modules/core/client/react-app/ReactAppShell.tsx',
);
const shellIds = fs.existsSync(shellFile)
  ? readSource(shellFile).ids
  : new Set();
let checked = 0;
for (const module of fs.readdirSync(path.join(root, 'modules'))) {
  const directory = path.join(root, 'modules', module, 'client');
  if (!fs.existsSync(directory)) continue;
  for (const file of clientFiles(directory)) {
    const record = readSource(file);
    for (const { href, line } of record.links) {
      if (!href || href === '#') continue;
      const destination = new URL(href, 'https://www.trustroots.org/');
      if (
        !['trustroots.org', 'www.trustroots.org'].includes(destination.hostname)
      )
        continue;
      // API downloads are server endpoints, not browser routes.
      if (destination.pathname.startsWith('/api/')) continue;
      checked += 1;
      let problem;
      if (href.startsWith('#')) {
        const fragment = decodeURIComponent(destination.hash.slice(1));
        if (!shellIds.has(fragment) && !collectIds([file]).has(fragment))
          problem = 'missing fragment';
      } else if (!href.startsWith('/') && !/^https?:/.test(href)) {
        problem = 'relative browser route; use an absolute path';
      } else {
        const policy = getReactRoutePolicy(destination.pathname);
        if (
          !policy ||
          (policy.path === '/not-found' &&
            destination.pathname !== '/not-found')
        ) {
          const asset = path.join(
            root,
            'public',
            destination.pathname.slice(1),
          );
          if (!fs.existsSync(asset) || !fs.statSync(asset).isFile())
            problem = 'unknown route';
        } else if (
          destination.hash &&
          !shellIds.has(decodeURIComponent(destination.hash.slice(1))) &&
          !routeIds
            .get(policy.path)
            ?.has(decodeURIComponent(destination.hash.slice(1)))
        ) {
          problem = 'missing fragment';
        }
      }
      if (problem)
        errors.push(
          `${path.relative(root, file)}:${line}: ${href} (${problem})`,
        );
    }
  }
}
if (errors.length) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Checked ${checked} literal internal client links.\n`);
}
