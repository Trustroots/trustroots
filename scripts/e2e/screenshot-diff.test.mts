import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { diffScreenshots } from './screenshot-diff.mts';

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-diff-'));

async function square(
  file: string,
  width: number,
  height: number,
  marked = false,
) {
  const image = sharp({
    create: { width, height, channels: 3, background: '#ffffff' },
  });
  const mark = await sharp({
    create: { width: 1, height: 1, channels: 3, background: '#000000' },
  })
    .png()
    .toBuffer();
  await (marked ? image.composite([{ input: mark, left: 0, top: 0 }]) : image)
    .png()
    .toFile(file);
}

test('diffs shots present in both runs and pads size changes', async () => {
  const [before, after, diff] = [temp(), temp(), temp()];
  await square(path.join(before, 'same.png'), 4, 4);
  await square(path.join(after, 'same.png'), 4, 4);
  await square(path.join(before, 'dot.png'), 4, 4);
  await square(path.join(after, 'dot.png'), 4, 4, true);
  await square(path.join(before, 'taller.png'), 4, 2);
  await square(path.join(after, 'taller.png'), 4, 4);
  await square(path.join(after, 'new.png'), 4, 4);

  await diffScreenshots(before, after, diff);

  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(diff, 'diffs.json'), 'utf8')),
    {
      'dot.png': { changed: 1 / 16, before: [4, 4], after: [4, 4] },
      'same.png': { changed: 0, before: [4, 4], after: [4, 4] },
      'taller.png': { changed: 0.5, before: [4, 2], after: [4, 4] },
    },
  );
  assert.deepEqual(fs.readdirSync(diff).sort(), [
    'diffs.json',
    'dot.png',
    'same.png',
    'taller.png',
  ]);
  const { data, info } = await sharp(path.join(diff, 'dot.png'))
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [4, 4]);
  assert.deepEqual([...data.subarray(0, 3)], [255, 0, 0]);
  assert.notDeepEqual([...data.subarray(4, 7)], [255, 0, 0]);
});
