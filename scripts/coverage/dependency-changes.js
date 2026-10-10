const { execFileSync } = require('child_process');

function compareEntries(before, after) {
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

function summariseDependencies(before, after) {
  const resolved = lock =>
    Object.fromEntries(
      Object.entries(lock.packages || {})
        .filter(([name, entry]) => name && entry.version)
        .map(([name, entry]) => [name, entry.version]),
    );
  return [
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
  ].map(([label, previous = {}, current = {}]) => ({
    label,
    ...compareEntries(previous, current),
  }));
}

function collectDependencyChanges(baseSha, headSha, cwd) {
  if (![baseSha, headSha].every(sha => /^[a-f0-9]{40,64}$/i.test(sha || ''))) {
    throw new Error('PR base and head commit SHAs are required');
  }
  const git = args =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    }).trim();
  const mergeBase = git(['merge-base', baseSha, headSha]);
  const read = sha => {
    const files = git([
      'ls-tree',
      '--name-only',
      sha,
      '--',
      'package.json',
      'package-lock.json',
    ]).split('\n');
    const json = file =>
      files.includes(file) ? JSON.parse(git(['show', `${sha}:${file}`])) : {};
    return { manifest: json('package.json'), lock: json('package-lock.json') };
  };
  return summariseDependencies(read(mergeBase), read(headSha));
}

function renderDependencyChanges(groups) {
  const signed = value =>
    value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0';
  const escape = value =>
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
    '### Dependency changes',
    '',
    '| Category | Added | Removed | Updated | Net |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...groups.map(
      group =>
        `| ${group.label} | ${signed(group.added)} | ${signed(
          -group.removed,
        )} | ${group.changed} | **${signed(group.net)}** |`,
    ),
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

function renderProductionInventory(inventory) {
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
