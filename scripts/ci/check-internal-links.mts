import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { getReactRoutePolicy } from '../../modules/core/shared/react-route-ownership.mts';

const root = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
interface LinkRecord {
  href: string;
  line: number;
}

interface SourceRecord {
  source: ts.SourceFile;
  ids: Set<string>;
  links: LinkRecord[];
  imports: Map<string, string>;
  declarations: Map<string, ts.Declaration>;
}

const records = new Map<string, SourceRecord>();

function resolveSource(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/')
    ? path.join(root, specifier.slice(2))
    : specifier.startsWith('.')
      ? path.resolve(path.dirname(from), specifier)
      : null;
  if (!base) return null;
  const stem = base.replace(/\.[cm]?[jt]sx?$/, '');
  return (
    [
      base,
      ...['.tsx', '.ts', '.mts', '.js', '/index.tsx', '/index.ts'].map(
        ext => stem + ext,
      ),
    ].find(
      candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
    ) ?? null
  );
}

function literal(node: ts.Node | undefined): string | null {
  if (node && ts.isJsxExpression(node)) return literal(node.expression);
  return node &&
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null;
}

function readSource(file: string): SourceRecord {
  if (records.has(file)) return records.get(file)!;
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const record = {
    source,
    ids: new Set<string>(),
    links: [] as LinkRecord[],
    imports: new Map<string, string>(),
    declarations: new Map<string, ts.Declaration>(),
  };
  records.set(file, record);
  function visit(node: ts.Node): void {
    // Some sections are generated from objects with literal id fields.
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'id') {
      const value = literal(node.initializer);
      if (value !== null) record.ids.add(value);
    }
    if (ts.isJsxAttribute(node)) {
      const value = literal(node.initializer);
      const attributeName = node.name.getText(source);
      if (value !== null && attributeName === 'id') record.ids.add(value);
      if (value !== null && attributeName === 'href') {
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

function importedFiles(
  record: SourceRecord,
  node: ts.Node,
  seen = new Set<string>(),
): Set<string> {
  const files = new Set<string>();
  function visit(child: ts.Node): void {
    if (ts.isIdentifier(child)) {
      const name = child.text;
      if (record.imports.has(name)) files.add(record.imports.get(name)!);
      if (!seen.has(name) && record.declarations.has(name)) {
        seen.add(name);
        visit(record.declarations.get(name)!);
      }
    }
    ts.forEachChild(child, visit);
  }
  visit(node);
  return files;
}

function collectIds(
  files: Iterable<string>,
  seen = new Set<string>(),
): Set<string> {
  const ids = new Set<string>();
  for (const file of files) {
    if (seen.has(file)) continue;
    seen.add(file);
    const record = readSource(file);
    record.ids.forEach(id => ids.add(id));
    collectIds(record.imports.values(), seen).forEach(id => ids.add(id));
  }
  return ids;
}

function clientFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? clientFiles(file)
      : /\.[jt]sx?$/.test(file)
        ? [file]
        : [];
  });
}

const routeIds = new Map<string, Set<string>>();
for (const file of clientFiles(path.join(root, 'layers/shell/client/routes'))) {
  const routeFile = readSource(file);
  const findRoute = (node: ts.Node): void => {
    const [route, ...rest] = ts.isCallExpression(node) ? node.arguments : [];
    if (route && ts.isStringLiteral(route) && route.text.startsWith('/')) {
      const files = rest.flatMap(arg => [...importedFiles(routeFile, arg)]);
      routeIds.set(route.text, collectIds(files));
    }
    ts.forEachChild(node, findRoute);
  };
  findRoute(routeFile.source);
}

const errors: string[] = [];
const shellFile = path.join(root, 'layers/shell/client/ReactAppShell.tsx');
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
