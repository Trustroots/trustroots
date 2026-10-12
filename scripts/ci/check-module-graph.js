#!/usr/bin/env node
/**
 * Records which `modules/*` depend on which and fails when the graph differs
 * from `module-graph-baseline.json`, so links between modules can only be
 * removed, never added unnoticed.
 *
 *   node scripts/ci/check-module-graph.js            check against the baseline
 *   node scripts/ci/check-module-graph.js --update   rewrite the baseline
 *   node scripts/ci/check-module-graph.js --graph    print the graph and cycles
 *
 * Two kinds of links are recorded, both from non-test code in
 * `modules/<name>/{client,server,shared}`:
 * - imports: `@/modules/x/...`, `modules/x/...` and relative paths into another module.
 * - models: `mongoose.model('X')` for a model that another module defines.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_FILE = 'module-graph-baseline.json';
const SOURCE_DIRS = ['client', 'server', 'shared'];
const SOURCE_FILE = /\.(js|mjs|cjs|ts|tsx)$/;
const SPECIFIER =
  /(?:\bfrom|\bimport|\brequire|\bresolve|\bmock|\bimportActual)\s*\(?\s*(['"])([^'"\n]+)\1/g;
const MODEL_DEFINITION = /\bmodel\(\s*(['"])(\w+)\1\s*,/g;
const MODEL_LOOKUP = /\bmodel\(\s*(['"])(\w+)\1\s*\)/g;

function listModules(root) {
  return fs
    .readdirSync(path.join(root, 'modules'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

function listSourceFiles(dir) {
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

function matches(pattern, text) {
  return [...text.matchAll(pattern)];
}

function targetModule(specifier, file, root, modules) {
  let resolved;
  if (specifier.startsWith('.')) {
    resolved = path.relative(root, path.resolve(path.dirname(file), specifier));
  } else {
    resolved = specifier.replace(/^@\//, '');
  }
  const [top, name] = resolved.split(path.sep).join('/').split('/');
  return top === 'modules' && modules.includes(name) ? name : null;
}

function analyze(root = ROOT) {
  const modules = listModules(root);
  const files = modules.flatMap(name =>
    SOURCE_DIRS.flatMap(dir =>
      listSourceFiles(path.join(root, 'modules', name, dir)).map(file => ({
        module: name,
        file,
        text: fs.readFileSync(file, 'utf8'),
      })),
    ),
  );

  const modelOwners = {};
  files.forEach(({ module, text }) => {
    matches(MODEL_DEFINITION, text).forEach(([, , model]) => {
      modelOwners[model] = module;
    });
  });

  const imports = {};
  const models = {};
  const add = (graph, from, to) => {
    if (from !== to) {
      graph[from] = [...new Set([...(graph[from] || []), to])].sort();
    }
  };
  files.forEach(({ module, file, text }) => {
    matches(SPECIFIER, text).forEach(([, , specifier]) => {
      const target = targetModule(specifier, file, root, modules);
      if (target) {
        add(imports, module, target);
      }
    });
    matches(MODEL_LOOKUP, text).forEach(([, , model]) => {
      if (modelOwners[model]) {
        add(models, module, modelOwners[model]);
      }
    });
  });

  return { imports: sortKeys(imports), models: sortKeys(models) };
}

function sortKeys(object) {
  return Object.fromEntries(
    Object.entries(object).sort(([a], [b]) => a.localeCompare(b)),
  );
}

function edgeList(graph) {
  return Object.entries(graph).flatMap(([from, targets]) =>
    targets.map(to => `${from} -> ${to}`),
  );
}

function diffGraphs(baseline, current) {
  const result = { added: [], removed: [] };
  ['imports', 'models'].forEach(kind => {
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
function findCycles(graph) {
  const nodes = [
    ...new Set([...Object.keys(graph), ...Object.values(graph).flat()]),
  ].sort();
  const index = {};
  const low = {};
  const onStack = new Set();
  const stack = [];
  const cycles = [];
  let counter = 0;

  const visit = node => {
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
      const component = [];
      let member;
      do {
        member = stack.pop();
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

function formatGraph(graph) {
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

function main(argv, root = ROOT) {
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

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { analyze, diffGraphs, findCycles, main };
