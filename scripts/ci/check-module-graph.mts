#!/usr/bin/env node
/**
 * Records which `modules/*` depend on which and fails when the graph differs
 * from `module-graph-baseline.json`, so links between modules can only be
 * removed, never added unnoticed.
 *
 *   node scripts/ci/check-module-graph.mts            check against the baseline
 *   node scripts/ci/check-module-graph.mts --update   rewrite the baseline
 *   node scripts/ci/check-module-graph.mts --graph    print the graph and cycles
 *
 * Two kinds of links are recorded, both from non-test code in
 * `modules/<name>/{client,server,shared}`:
 * - imports: `@trustroots/x`, `@/modules/x/...`, `modules/x/...` and relative paths.
 * - models: `mongoose.model('X')` for a model that another module defines.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

type Graph = Record<string, string[]>;
type ModuleGraph = { imports: Graph; models: Graph };
type SourceLinks = {
  imports: string[];
  definitions: string[];
  lookups: string[];
};

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BASELINE_FILE = 'module-graph-baseline.json';
const SOURCE_DIRS = ['client', 'server', 'shared'];
const SOURCE_FILE = /\.(js|mjs|cjs|ts|mts|cts|tsx)$/;

function listModules(root: string): string[] {
  return fs
    .readdirSync(path.join(root, 'modules'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

function listSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : listSourceFiles(full);
    }
    return SOURCE_FILE.test(entry.name) ? [full] : [];
  });
}

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith('.tsx') || file.endsWith('.jsx') || file.endsWith('.js')) {
    return ts.ScriptKind.TSX;
  }
  if (file.endsWith('.mts') || file.endsWith('.cts') || file.endsWith('.ts')) {
    return ts.ScriptKind.TS;
  }
  return ts.ScriptKind.JS;
}

function sourceLinks(file: string, text: string): SourceLinks {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(file),
  );
  const imports: string[] = [];
  const definitions: string[] = [];
  const lookups: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    }
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      imports.push(node.argument.literal.text);
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : ts.isIdentifier(callee)
          ? callee.text
          : callee.kind === ts.SyntaxKind.ImportKeyword
            ? 'import'
            : null;
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteral(argument)) {
        if (
          name !== null &&
          ['import', 'require', 'resolve', 'mock', 'importActual'].includes(
            name,
          )
        ) {
          imports.push(argument.text);
        }
        if (name === 'model') {
          (node.arguments.length > 1 ? definitions : lookups).push(
            argument.text,
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { imports, definitions, lookups };
}

function targetModule(
  specifier: string,
  file: string,
  root: string,
  modules: string[],
): string | null {
  if (specifier.startsWith('@trustroots/')) {
    const name = specifier.split('/')[1];
    return modules.includes(name) ? name : null;
  }
  let resolved;
  if (specifier.startsWith('.')) {
    resolved = path.relative(root, path.resolve(path.dirname(file), specifier));
  } else {
    resolved = specifier.replace(/^@\//, '');
  }
  const [top, name] = resolved.split(path.sep).join('/').split('/');
  return top === 'modules' && modules.includes(name) ? name : null;
}

export function analyze(root = ROOT): ModuleGraph {
  const modules = listModules(root);
  const files = modules.flatMap(name =>
    SOURCE_DIRS.flatMap(dir =>
      listSourceFiles(path.join(root, 'modules', name, dir)).map(file => ({
        module: name,
        file,
        links: sourceLinks(file, fs.readFileSync(file, 'utf8')),
      })),
    ),
  );

  const modelOwners: Record<string, string> = {};
  files.forEach(({ module, links }) => {
    links.definitions.forEach(model => {
      modelOwners[model] = module;
    });
  });

  const imports: Graph = {};
  const models: Graph = {};
  const add = (graph: Graph, from: string, to: string): void => {
    if (from !== to) {
      graph[from] = [...new Set([...(graph[from] || []), to])].sort();
    }
  };
  files.forEach(({ module, file, links }) => {
    links.imports.forEach(specifier => {
      const target = targetModule(specifier, file, root, modules);
      if (target) {
        add(imports, module, target);
      }
    });
    links.lookups.forEach(model => {
      if (modelOwners[model]) {
        add(models, module, modelOwners[model]);
      }
    });
  });

  return { imports: sortKeys(imports), models: sortKeys(models) };
}

export function missingModelDependencies(
  graph: ModuleGraph,
  root = ROOT,
): string[] {
  return Object.entries(graph.models).flatMap(([consumer, owners]) =>
    owners.flatMap(owner => {
      const manifestPath = path.join(root, 'modules', consumer, 'package.json');
      if (!fs.existsSync(manifestPath)) {
        return [`${consumer} -> ${owner}: missing ${manifestPath}`];
      }
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        dependencies?: Record<string, string>;
      };
      return manifest.dependencies?.[`@trustroots/${owner}`] === 'workspace:*'
        ? []
        : [
            `${consumer} -> ${owner}: missing @trustroots/${owner} workspace dependency`,
          ];
    }),
  );
}

function sortKeys(object: Graph): Graph {
  return Object.fromEntries(
    Object.entries(object).sort(([a], [b]) => a.localeCompare(b)),
  );
}

function edgeList(graph: Graph): string[] {
  return Object.entries(graph).flatMap(([from, targets]) =>
    targets.map(to => `${from} -> ${to}`),
  );
}

export function diffGraphs(baseline: ModuleGraph, current: ModuleGraph) {
  const result: { added: string[]; removed: string[] } = {
    added: [],
    removed: [],
  };
  (['imports', 'models'] as const).forEach(kind => {
    const before = new Set(edgeList(baseline[kind] || {}));
    const after = new Set(edgeList(current[kind] || {}));
    after.forEach(
      edge => before.has(edge) || result.added.push(`${kind}: ${edge}`),
    );
    before.forEach(
      edge => after.has(edge) || result.removed.push(`${kind}: ${edge}`),
    );
  });
  return result;
}

// Tarjan's strongly connected components, keeping those with more than one module.
export function findCycles(graph: Graph): string[][] {
  const nodes = [
    ...new Set([...Object.keys(graph), ...Object.values(graph).flat()]),
  ].sort();
  const index: Record<string, number> = {};
  const low: Record<string, number> = {};
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  let counter = 0;

  const visit = (node: string): void => {
    index[node] = low[node] = counter++;
    stack.push(node);
    onStack.add(node);
    (graph[node] || []).forEach(next => {
      if (index[next] === undefined) {
        visit(next);
        low[node] = Math.min(low[node], low[next]);
      } else if (onStack.has(next)) {
        low[node] = Math.min(low[node], index[next]);
      }
    });
    if (low[node] === index[node]) {
      const component: string[] = [];
      let member: string;
      do {
        member = stack.pop()!;
        onStack.delete(member);
        component.push(member);
      } while (member !== node);
      if (component.length > 1) {
        cycles.push(component.sort());
      }
    }
  };

  nodes.forEach(node => index[node] === undefined && visit(node));
  return cycles.sort((a, b) => a[0].localeCompare(b[0]));
}

function formatGraph(graph: ModuleGraph): string {
  const cycles = findCycles(graph.imports);
  const lines = Object.entries(graph.imports).map(
    ([from, targets]) => `${from}: ${targets.join(', ')}`,
  );
  lines.push(
    '',
    cycles.length
      ? `Import cycles: ${cycles.map(cycle => cycle.join(' <-> ')).join('; ')}`
      : 'No import cycles.',
  );
  return lines.join('\n');
}

export function main(argv: string[], root = ROOT): number {
  const baselinePath = path.join(root, BASELINE_FILE);
  const current = analyze(root);

  if (argv.includes('--graph')) {
    console.log(formatGraph(current));
    return 0;
  }

  if (argv.includes('--update')) {
    fs.writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`Wrote ${BASELINE_FILE}`);
    return 0;
  }

  if (!fs.existsSync(baselinePath)) {
    console.error(
      `${BASELINE_FILE} is missing. Run: npm run modules:update-baseline`,
    );
    return 1;
  }

  const missingDependencies = missingModelDependencies(current, root);
  if (missingDependencies.length) {
    console.error(
      `Undeclared model dependencies:\n${missingDependencies
        .map(edge => `  ${edge}`)
        .join('\n')}\nAdd the owning module as a workspace dependency.`,
    );
    return 1;
  }

  const { added, removed } = diffGraphs(
    JSON.parse(fs.readFileSync(baselinePath, 'utf8')),
    current,
  );

  if (added.length) {
    console.error(
      `New links between modules, not in ${BASELINE_FILE}:\n${added
        .map(edge => `  + ${edge}`)
        .join('\n')}\n` +
        'Avoid the new dependency, or (if it is intended) run `npm run modules:update-baseline` and explain it in the PR.',
    );
  }
  if (removed.length) {
    console.error(
      `Links in ${BASELINE_FILE} that no longer exist:\n${removed
        .map(edge => `  - ${edge}`)
        .join('\n')}\n` +
        'Run `npm run modules:update-baseline` to lock in the improvement.',
    );
  }
  if (added.length || removed.length) {
    return 1;
  }

  console.log('Module graph matches the baseline.');
  return 0;
}

if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2));
}
