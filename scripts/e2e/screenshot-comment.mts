import fs from 'node:fs';
import path from 'node:path';

type Options = {
  beforeDir: string;
  afterDir: string;
  diffDir: string;
  baseUrl: string;
  runUrl: string;
  testStatus: number;
};

const pngs = (directory: string) =>
  fs.existsSync(directory)
    ? fs.readdirSync(directory).filter(file => file.endsWith('.png'))
    : [];

export function buildScreenshotComment({
  beforeDir,
  afterDir,
  diffDir,
  baseUrl,
  runUrl,
  testStatus,
}: Options) {
  const lines = [
    '<!-- e2e-screenshots -->',
    '## E2E screenshots',
    '',
    `Run: \`${runUrl}\``,
  ];
  if (testStatus !== 0)
    lines.push(
      '',
      '_Some changed e2e specs failed; screenshots below may include failure states._',
    );

  const files = pngs(afterDir).sort();
  if (files.length === 0) {
    lines.push('', '_No screenshots were captured._');
    return `${lines.join('\n')}\n`;
  }

  lines.push(
    '',
    '_The site header stays fixed to the top of the viewport. A full-page screenshot is stitched from scrolled slices, so that header can appear part-way down the image, over the page content._',
  );
  const before = new Set(pngs(beforeDir));
  const diffsFile = path.join(diffDir, 'diffs.json');
  const diffs: Record<
    string,
    { changed: number; before: number[]; after: number[] }
  > = fs.existsSync(diffsFile)
    ? JSON.parse(fs.readFileSync(diffsFile, 'utf8'))
    : {};
  for (const file of files) {
    const title = file.replace(/\.png$/, '').replace(/_/g, ' ');
    const image = (side: string) =>
      `<img width="300" alt="${title} ${side}" src="${baseUrl}/${side}/${encodeURIComponent(file)}">`;
    const urlPath = path.join(afterDir, file.replace(/\.png$/, '.url'));
    lines.push('', `### ${title}`);
    if (fs.existsSync(urlPath))
      lines.push(
        '',
        `URL: \`${fs.readFileSync(urlPath, 'utf8').replace(/`/g, '%60')}\``,
      );
    const diff = diffs[file];
    const size =
      diff && diff.before.join() !== diff.after.join()
        ? `, size ${diff.before.join('×')} → ${diff.after.join('×')}`
        : '';
    const change = !diff
      ? '—'
      : `${image('diff')}<br>${diff.changed === 0 ? 'no change' : `${(diff.changed * 100).toFixed(2)}% of pixels changed`}${size}`;
    lines.push(
      '',
      '| Before | After | Diff |',
      '| --- | --- | --- |',
      `| ${before.has(file) ? image('before') : '—'} | ${image('after')} | ${change} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}
