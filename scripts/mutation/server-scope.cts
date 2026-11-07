#!/usr/bin/env node

// Decides which server source a mutation run should mutate, split into one
// shard per module so CI can run them in parallel.
//
// Pull requests are mapped from their changed files:
//
// - A changed server source file is mutated itself.
// - A changed, added or deleted server test file (anything under
//   modules/<name>/tests/server/) mutates every server source file of
//   <name>, plus any server source file in another module or package that
//   the test imports directly, in its old or new version. Tests reach
//   most of the code they check over HTTP and the job queue, so the
//   module directory is the main mapping and the imports catch the
//   cross-module unit tests. Deleting or weakening a test therefore re-runs
//   the mutants it used to kill.
// - A change to shared test infrastructure (testutils/server, the Vitest or
//   Stryker server configs, this script, the mutation floors) can affect
//   any test, so it mutates the whole server.
//
// Everything else, and anything the mapping misses (a test in one module
// that only reaches another module over HTTP), is covered by the full run:
// the mutation workflow mutates the whole server every week and on demand.
//
//   node scripts/mutation/server-scope.cts --base=<sha> [--head=HEAD]
//   node scripts/mutation/server-scope.cts --full
//
// prints a JSON array of shards: { name, files, reasons }.

const { execFileSync } =
  require('child_process') as typeof import('node:child_process');
const path = require('path') as typeof import('node:path');

// Mutate exactly what the server coverage report measures, minus the files
// stryker.server.config.mjs explains.
const mutatePatterns = [
  'modules/*/server/**/*.{mjs,mts}',
  'packages/analytics/server/**/*.mts',
  'packages/logger/**/*.mts',
  '!modules/*/tests/**',
  '!**/node_modules/**',
  '!modules/*/server/**/*.model.{mjs,mts}',
  '!modules/*/server/models/**',
  '!modules/core/server/jobs/send-push-message.server.job.mjs',
  '!modules/users/server/jobs/user-welcome-sequence-*.server.job.{mjs,mts}',
  // Its guard stops rm -rf on the working directory. With the guard mutated
  // away, its own test deletes the Stryker sandbox and breaks every worker.
  '!modules/core/server/services/file-removal.server.service.mts',
];

const included = [
  /^modules\/[^/]+\/server\/.*\.m[jt]s$/,
  /^packages\/analytics\/server\/.*\.mts$/,
  /^packages\/logger\/.*\.mts$/,
];
const excluded = [
  /^modules\/[^/]+\/tests\//,
  /(^|\/)node_modules\//,
  /^modules\/[^/]+\/server\/.*\.model\.m[jt]s$/,
  /^modules\/[^/]+\/server\/models\//,
  /^modules\/core\/server\/jobs\/send-push-message\.server\.job\.mjs$/,
  /^modules\/users\/server\/jobs\/user-welcome-sequence-[^/]*\.server\.job\.m[jt]s$/,
  /^modules\/core\/server\/services\/file-removal\.server\.service\.mts$/,
];

// Changes here can change the outcome of any server test.
const sharedInfrastructure = [
  /^testutils\/server\//,
  /^vitest\.server\.config\.mts$/,
  /^vitest\.stryker\.server\.config\.mts$/,
  /^stryker\.server\.config\.mjs$/,
  /^scripts\/mutation\//,
  /^tooling\/stryker\//,
  /^tooling\/baselines\/mutation\.json$/,
];

type Status = 'A' | 'C' | 'D' | 'M' | 'R' | 'T';

interface Change {
  status: Status;
  path: string;
  // The path before a rename or copy.
  oldPath?: string;
}

interface Shard {
  name: string;
  files: string[];
  reasons: string[];
}

interface ScopeInput {
  changes: Change[];
  // Every tracked file at the head commit.
  files: string[];
  // A file's content at the base (`base`) or head (`head`) commit, or
  // undefined if it doesn't exist there.
  read: (version: 'base' | 'head', file: string) => string | undefined;
}

function isMutable(file: string): boolean {
  return (
    included.some(pattern => pattern.test(file)) &&
    !excluded.some(pattern => pattern.test(file))
  );
}

// The shard a source file belongs to: its module, or the package name.
function shardOf(file: string): string {
  const [root, name] = file.split('/');
  return root === 'packages' ? `package-${name}` : name;
}

function serverTestModule(file: string): string | undefined {
  return /^modules\/([^/]+)\/tests\/server\//.exec(file)?.[1];
}

// Relative import, require and dynamic import specifiers in a source file.
function relativeImports(source: string): string[] {
  const specifiers = new Set<string>();
  const patterns = [
    /\brequire\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
    /\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
    /\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]/g,
    /^\s*import\s+['"](\.{1,2}\/[^'"]+)['"]/gm,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

function importedSources(
  testFile: string,
  source: string,
  mutable: Set<string>,
): string[] {
  const found: string[] = [];
  for (const specifier of relativeImports(source)) {
    const resolved = path.posix.normalize(
      path.posix.join(path.posix.dirname(testFile), specifier),
    );
    const candidate = [resolved, `${resolved}.mts`, `${resolved}.mjs`].find(
      file => mutable.has(file),
    );
    if (candidate) found.push(candidate);
  }
  return found;
}

function planFull(files: string[], reason: string): Shard[] {
  const shards = new Map<string, Shard>();
  for (const file of files.filter(isMutable).sort()) {
    const name = shardOf(file);
    const shard = shards.get(name) ?? { name, files: [], reasons: [reason] };
    shard.files.push(file);
    shards.set(name, shard);
  }
  return [...shards.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function planScope({ changes, files, read }: ScopeInput): Shard[] {
  const mutable = new Set(files.filter(isMutable));
  const shared = changes.find(change =>
    [change.path, change.oldPath].some(
      file => file && sharedInfrastructure.some(pattern => pattern.test(file)),
    ),
  );
  if (shared) {
    return planFull(
      files,
      `shared test infrastructure changed: ${shared.path}`,
    );
  }

  const shards = new Map<
    string,
    { files: Set<string>; reasons: Set<string> }
  >();
  const add = (file: string, reason: string) => {
    const name = shardOf(file);
    const shard = shards.get(name) ?? { files: new Set(), reasons: new Set() };
    shard.files.add(file);
    shard.reasons.add(reason);
    shards.set(name, shard);
  };

  for (const change of changes) {
    if (change.status !== 'D' && mutable.has(change.path)) {
      add(change.path, `source changed: ${change.path}`);
    }
    for (const file of new Set([change.path, change.oldPath])) {
      if (!file) continue;
      const module = serverTestModule(file);
      if (!module) continue;
      const reason = `server test changed: ${file}`;
      for (const source of mutable) {
        if (source.startsWith(`modules/${module}/server/`)) add(source, reason);
      }
      for (const version of ['base', 'head'] as const) {
        const content = read(version, file);
        if (content === undefined) continue;
        for (const source of importedSources(file, content, mutable)) {
          add(source, reason);
        }
      }
    }
  }

  return [...shards.entries()]
    .map(([name, shard]) => ({
      name,
      files: [...shard.files].sort(),
      reasons: [...shard.reasons].sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function git(args: string[]): string {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function changesBetween(base: string, head: string): Change[] {
  // -z keeps unusual file names intact; renames list old then new path.
  const fields = git([
    'diff',
    '--name-status',
    '-z',
    '--find-renames',
    `${base}...${head}`,
  ]).split('\0');
  const changes: Change[] = [];
  for (let index = 0; index < fields.length - 1;) {
    const status = fields[index][0] as Status;
    if (status === 'R' || status === 'C') {
      changes.push({
        status,
        oldPath: fields[index + 1],
        path: fields[index + 2],
      });
      index += 3;
    } else {
      changes.push({ status, path: fields[index + 1] });
      index += 2;
    }
  }
  return changes;
}

function main(argv: string[]): void {
  const option = (name: string): string | undefined =>
    argv.find(arg => arg.startsWith(`--${name}=`))?.split('=')[1];
  const head = option('head') ?? 'HEAD';
  const files = git(['ls-tree', '-r', '--name-only', head])
    .split('\n')
    .filter(Boolean);
  const base = option('base');
  let shards: Shard[];
  if (argv.includes('--full')) {
    shards = planFull(files, 'full run');
  } else if (base) {
    const mergeBase = git(['merge-base', base, head]).trim();
    shards = planScope({
      changes: changesBetween(base, head),
      files,
      read: (version, file) => {
        try {
          return git([
            'show',
            `${version === 'base' ? mergeBase : head}:${file}`,
          ]);
        } catch {
          return undefined;
        }
      },
    });
  } else {
    console.error('Pass --base=<sha> or --full.');
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify(shards)}\n`);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = {
  isMutable,
  mutatePatterns,
  planFull,
  planScope,
  relativeImports,
};
