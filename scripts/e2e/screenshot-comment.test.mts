import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { buildScreenshotComment } from './screenshot-comment.mts';

function shots(files: Record<string, string>) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-comment-'));
  for (const [file, content] of Object.entries(files))
    fs.writeFileSync(path.join(directory, file), content);
  return directory;
}

const options = {
  baseUrl: 'https://raw.example/pr-1/42',
  runUrl: 'https://github.example/runs/42',
};

const img = (side: string, title: string, file: string) =>
  `<img width="300" alt="${title} ${side}" src="https://raw.example/pr-1/42/${side}/${file}">`;

test('shows before, after and diff, with dashes for new shots', () => {
  const body = buildScreenshotComment({
    ...options,
    beforeDir: shots({
      'chromium-Card.png': 'old',
      'chromium-Same.png': 'old',
      'chromium-Taller.png': 'old',
    }),
    afterDir: shots({
      'chromium-Card.png': 'new',
      'chromium-Card.url': 'http://localhost/`card`',
      'chromium-New_section.png': 'new',
      'chromium-Same.png': 'old',
      'chromium-Taller.png': 'new',
    }),
    diffDir: shots({
      'diffs.json': JSON.stringify({
        'chromium-Card.png': {
          changed: 0.0321,
          before: [120, 80],
          after: [120, 80],
        },
        'chromium-Same.png': { changed: 0, before: [10, 10], after: [10, 10] },
        'chromium-Taller.png': {
          changed: 0.5,
          before: [120, 80],
          after: [120, 160],
        },
      }),
    }),
    testStatus: 0,
  });
  assert.match(body, /^<!-- e2e-screenshots -->\n## E2E screenshots\n/);
  assert.match(body, /Run: `https:\/\/github\.example\/runs\/42`/);
  assert.doesNotMatch(body, /failed/);
  assert.ok(
    body.includes(
      [
        '### chromium-Card',
        '',
        'URL: `http://localhost/%60card%60`',
        '',
        '| Before | After | Diff |',
        '| --- | --- | --- |',
        `| ${img('before', 'chromium-Card', 'chromium-Card.png')} | ${img('after', 'chromium-Card', 'chromium-Card.png')} | ${img('diff', 'chromium-Card', 'chromium-Card.png')}<br>3.21% of pixels changed |`,
      ].join('\n'),
    ),
  );
  assert.ok(
    body.includes(
      `| — | ${img('after', 'chromium-New section', 'chromium-New_section.png')} | — |`,
    ),
  );
  assert.ok(
    body.includes(
      `| ${img('diff', 'chromium-Same', 'chromium-Same.png')}<br>no change |`,
    ),
  );
  assert.ok(
    body.includes(
      `| ${img('diff', 'chromium-Taller', 'chromium-Taller.png')}<br>50.00% of pixels changed, size 120×80 → 120×160 |`,
    ),
  );
});

test('notes failures and a missing base run', () => {
  const body = buildScreenshotComment({
    ...options,
    beforeDir: path.join(os.tmpdir(), 'e2e-comment-missing'),
    afterDir: shots({}),
    diffDir: path.join(os.tmpdir(), 'e2e-comment-missing'),
    testStatus: 1,
  });
  assert.match(body, /Some changed e2e specs failed/);
  assert.match(body, /_No screenshots were captured\._\n$/);
});
