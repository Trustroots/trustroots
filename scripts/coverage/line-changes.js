const { execFileSync } = require('child_process');
const startMarker = '<!-- trustroots-line-changes:start -->';
const endMarker = '<!-- trustroots-line-changes:end -->';

const categories = [
  ['code', '🧩 Application code'],
  ['tests', '🧪 Tests and fixtures'],
  ['other', '📄 Docs, configuration and other'],
  ['generated', '⚙️ Generated files and lockfiles'],
];

function categoryForPath(filePath) {
  if (
    /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|Gemfile\.lock)$/.test(
      filePath,
    ) ||
    /(^|\/)(generated|dist|vendor|node_modules)\//.test(filePath) ||
    /\.(generated\.|min\.(js|css)$|map$)/.test(filePath)
  ) {
    return 'generated';
  }
  if (
    /(^|\/)(tests?|__tests__|__mocks__|fixtures|jest)\//.test(filePath) ||
    /\.(spec|tests?)\.[^/]+$/.test(filePath)
  ) {
    return 'tests';
  }
  if (
    /(^|\/)(\.github|config)\//.test(filePath) ||
    /(^|\/)(\.[^/]+|[^/]*\.config\.[^/]+)$/.test(filePath)
  ) {
    return 'other';
  }
  return /\.(js|mjs|cjs|jsx|ts|tsx|css|less|scss|sass|html|vue|svelte|py|sh)$/.test(
    filePath,
  )
    ? 'code'
    : 'other';
}

function summariseNumstat(output) {
  const groups = categories.map(([id, label]) => ({
    id,
    label,
    added: 0,
    removed: 0,
    net: 0,
  }));
  let binaryFiles = 0;
  const records = output.split('\0');
  for (let index = 0; index < records.length; index += 1) {
    if (!records[index]) continue;
    const match = /^(\d+|-)\t(\d+|-)\t([\s\S]*)$/.exec(records[index]);
    if (!match) throw new Error('Invalid Git numstat record');
    let filePath = match[3];
    if (!filePath) {
      // Renames use three NUL-separated records: counts, old path, new path.
      filePath = records[index + 2];
      index += 2;
    }
    if (!filePath) throw new Error('Missing Git numstat path');
    if (match[1] === '-' || match[2] === '-') {
      binaryFiles += 1;
      continue;
    }
    const group = groups.find(item => item.id === categoryForPath(filePath));
    group.added += Number(match[1]);
    group.removed += Number(match[2]);
    group.net = group.added - group.removed;
  }
  return { groups, binaryFiles };
}

function collectLineChanges(baseSha, headSha, cwd) {
  if (![baseSha, headSha].every(sha => /^[a-f0-9]{40,64}$/i.test(sha || ''))) {
    throw new Error('PR base and head commit SHAs are required');
  }
  const output = execFileSync(
    'git',
    [
      'diff',
      '--numstat',
      '-z',
      '--find-renames',
      `${baseSha}...${headSha}`,
      '--',
    ],
    { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  return summariseNumstat(output);
}

function signed(value) {
  return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0';
}

function renderLineChanges(summary) {
  const rows = summary.groups.map(({ id, label, added, removed, net }) => {
    const preferred = (id === 'code' && net < 0) || (id === 'tests' && net > 0);
    const symbol =
      net === 0 || !['code', 'tests'].includes(id)
        ? '⚪'
        : preferred
        ? '🟢'
        : '🟡';
    return `| ${label} | ${signed(added)} | ${signed(
      -removed,
    )} | ${symbol} **${signed(net)}** |`;
  });
  return [
    startMarker,
    '### Line changes',
    '',
    '| Category | Added | Removed | Net |',
    '| --- | ---: | ---: | ---: |',
    ...rows,
    '',
    '🟢 Application code shrank or tests grew. 🟡 Application code grew or tests shrank; worth reviewing. ⚪ Unchanged or neutral.',
    '',
    'Compared with the PR merge base. Counts include blank lines and comments. Generated files and lockfiles are kept separate. These indicators do not affect CI success.',
    ...(summary.binaryFiles
      ? [
          '',
          `Binary files changed: ${summary.binaryFiles} (excluded from line totals).`,
        ]
      : []),
    endMarker,
  ].join('\n');
}

function updateLineChangesComment(body, summary) {
  const table = renderLineChanges(summary);
  const start = body.indexOf(startMarker);
  const end = body.indexOf(endMarker, start);
  return start >= 0 && end >= start
    ? `${body.slice(0, start)}${table}${body.slice(end + endMarker.length)}`
    : `${body.trimEnd()}\n\n${table}\n`;
}

module.exports = {
  categoryForPath,
  collectLineChanges,
  renderLineChanges,
  summariseNumstat,
  updateLineChangesComment,
};
