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

test('puts before and after side by side, with a dash for new shots', () => {
  const body = buildScreenshotComment({
    ...options,
    beforeDir: shots({ 'chromium-Card.png': 'old' }),
    afterDir: shots({
      'chromium-Card.png': 'new',
      'chromium-Card.url': 'http://localhost/`card`',
      'chromium-New_section.png': 'new',
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
        '| Before | After |',
        '| --- | --- |',
        '| <img width="400" alt="chromium-Card before" src="https://raw.example/pr-1/42/before/chromium-Card.png"> | <img width="400" alt="chromium-Card after" src="https://raw.example/pr-1/42/after/chromium-Card.png"> |',
      ].join('\n'),
    ),
  );
  assert.ok(
    body.includes(
      '| — | <img width="400" alt="chromium-New section after" src="https://raw.example/pr-1/42/after/chromium-New_section.png"> |',
    ),
  );
});

test('notes failures and a missing base run', () => {
  const body = buildScreenshotComment({
    ...options,
    beforeDir: path.join(os.tmpdir(), 'e2e-comment-missing'),
    afterDir: shots({}),
    testStatus: 1,
  });
  assert.match(body, /Some changed e2e specs failed/);
  assert.match(body, /_No screenshots were captured\._\n$/);
});
