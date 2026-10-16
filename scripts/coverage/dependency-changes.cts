const { execFileSync } =
  require('node:child_process') as typeof import('node:child_process');

interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface LockEntry {
  version?: string;
}

interface Lockfile {
  packages?: Record<string, LockEntry>;
}

interface DependencySnapshot {
  manifest: Manifest;
  lock: Lockfile;
}

interface DependencyChange {
  name: string;
  before: string | undefined;
  after: string | undefined;
}

interface DependencyGroup {
  label: string;
  added: number;
  removed: number;
  changed: number;
  net: number;
  changes: DependencyChange[];
}

interface InstalledPackage {
  name: string;
  version: string;
  path: string;
}

interface ProductionInventory {
  packages: InstalledPackage[];
}

function compareEntries(
  before: Record<string, string>,
  after: Record<string, string>,
): Omit<DependencyGroup, 'label'> {
  const changes = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .sort()
    .filter(name => before[name] !== after[name])
    .map(name => ({ name, before: before[name], after: after[name] }));
  const added = changes.filter(change => change.before === undefined).length;
  const removed = changes.filter(change => change.after === undefined).length;
  return {
    added,
    removed,
    changed: changes.length - added - removed,
    net: added - removed,
    changes,
  };
}

function summariseDependencies(
  before: DependencySnapshot,
  after: DependencySnapshot,
): DependencyGroup[] {
  const resolved = (lock: Lockfile): Record<string, string> =>
    Object.fromEntries(
      Object.entries(lock.packages || {})
        .filter((item): item is [string, LockEntry & { version: string }] =>
          Boolean(item[0] && item[1].version),
        )
        .map(([name, entry]) => [name, entry.version]),
    );
  const comparisons: Array<
    [
      string,
      Record<string, string> | undefined,
      Record<string, string> | undefined,
    ]
  > = [
    [
      'Direct runtime dependencies',
      before.manifest.dependencies,
      after.manifest.dependencies,
    ],
    [
      'Direct development dependencies',
      before.manifest.devDependencies,
      after.manifest.devDependencies,
    ],
    ['Resolved lockfile entries', resolved(before.lock), resolved(after.lock)],
  ];
  return comparisons.map(([label, previous = {}, current = {}]) => ({
    label,
    ...compareEntries(previous, current),
  }));
}

function pnpmLockfile(source: string): Lockfile {
  const versions: Record<string, string[]> = {};
  let inPackages = false;
  for (const line of source.split('\n')) {
    if (/^\S/.test(line)) inPackages = line === 'packages:';
    const match = inPackages && line.match(/^ {2}'?(@?[^@']+)@([^':]+)'?:/);
    if (match) (versions[match[1]] = versions[match[1]] || []).push(match[2]);
  }
  return {
    packages: Object.fromEntries(
      Object.entries(versions).map(([name, found]) => [
        name,
        { version: found.sort().join(', ') },
      ]),
    ),
  };
}

function collectDependencyChanges(
  baseSha: string,
  headSha: string,
  cwd: string,
): DependencyGroup[] {
  if (![baseSha, headSha].every(sha => /^[a-f0-9]{40,64}$/i.test(sha || ''))) {
    throw new Error('PR base and head commit SHAs are required');
  }
  const git = (args: string[]): string =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    }).trim();
  const mergeBase = git(['merge-base', baseSha, headSha]);
  const read = (sha: string): DependencySnapshot => {
    const files = git([
      'ls-tree',
      '--name-only',
      sha,
      '--',
      'package.json',
      'package-lock.json',
      'pnpm-lock.yaml',
    ]).split('\n');
    const json = (file: string): Manifest & Lockfile =>
      files.includes(file)
        ? (JSON.parse(git(['show', `${sha}:${file}`])) as Manifest & Lockfile)
        : {};
    const lock = files.includes('pnpm-lock.yaml')
      ? pnpmLockfile(git(['show', `${sha}:pnpm-lock.yaml`]))
      : json('package-lock.json');
    return { manifest: json('package.json'), lock };
  };
  return summariseDependencies(read(mergeBase), read(headSha));
}

function renderDependencyChanges(groups: DependencyGroup[]): string {
  const signed = (value: number): string =>
    value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0';
  const count = (value: number, colour: string): string =>
    `${value ? colour : '⚪'} ${signed(value)}`;
  const net = (value: number): string => count(value, value > 0 ? '🔵' : '🟢');
  const escape = (value: string): string =>
    String(value).replace(
      /[&<>|`\r\n]/g,
      character => `&#${character.charCodeAt(0)};`,
    );
  const details = groups.flatMap(group =>
    group.changes.map(
      change =>
        `| ${group.label} | ${escape(change.name)} | ${
          change.before === undefined ? '—' : escape(change.before)
        } | ${change.after === undefined ? '—' : escape(change.after)} |`,
    ),
  );
  return [
    '### Dependencies',
    '',
    '| Category | Added | Removed | Updated | Net |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...groups.map(
      group =>
        `| ${group.label} | ${count(group.added, '🔵')} | ${count(
          -group.removed,
          '🟢',
        )} | ${count(group.changed, '🟡').replace('+', '')} | **${net(
          group.net,
        )}** |`,
    ),
    '',
    '🔵 Added · 🟢 Removed · 🟡 Updated · ⚪ No change. Colours indicate change types, not dependency quality.',
    '',
    'Compared with the PR merge base. Direct rows count declared packages; resolved entries count installed lockfile paths, including duplicate copies. These rows overlap and must not be added together. Updates compare declared ranges or resolved versions. Counts do not measure production Docker pruning or determine CI success.',
    ...(details.length
      ? [
          '',
          '<details>',
          '<summary>Dependency details</summary>',
          '',
          '| Category | Package or installed path | Before | After |',
          '| --- | --- | --- | --- |',
          ...details.slice(0, 100),
          ...(details.length > 100
            ? [
                '',
                `Showing the first 100 of ${details.length} changes; the complete inventory is in the manifest and lockfile diff.`,
              ]
            : []),
          '',
          '</details>',
        ]
      : ['', 'No dependency declaration or resolved-version changes.']),
  ].join('\n');
}

function renderProductionInventory(
  inventory: ProductionInventory | null | undefined,
): string {
  if (!inventory) {
    return '### Production image dependencies\n\nInstalled inventory unavailable: the image was not built or its inventory was not collected.';
  }
  return [
    '### Production image dependencies',
    '',
    '| Measurement after pruning | Count |',
    '| --- | ---: |',
    `| Installed application npm package paths | ${inventory.packages.length} |`,
    `| Unique package name/version pairs | ${
      new Set(inventory.packages.map(entry => `${entry.name}@${entry.version}`))
        .size
    } |`,
    '',
    'Measured from the built production image, excluding global npm and operating-system packages. Download the `production-dependencies` artifact from this workflow run for the complete name, version and installed-path inventory. No previous-image comparison is performed.',
  ].join('\n');
}

module.exports = {
  collectDependencyChanges,
  summariseDependencies,
  renderDependencyChanges,
  renderProductionInventory,
};
