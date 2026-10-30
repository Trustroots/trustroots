// Exact pixel diff of BEFORE_DIR and AFTER_DIR screenshots, done in a canvas.
// Any channel difference counts. Writes DIFF_DIR/<dir>/<name>.png and results.json.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';

const beforeDir = process.env.BEFORE_DIR!;
const afterDir = process.env.AFTER_DIR!;
const diffDir = process.env.DIFF_DIR!;

test('pixel diff', async ({ page }) => {
  const results: {
    dir: string;
    name: string;
    width: [number, number];
    height: [number, number];
    differing: number;
  }[] = [];
  for (const dir of ['ltr', 'rtl']) {
    mkdirSync(join(diffDir, dir), { recursive: true });
    for (const file of readdirSync(join(beforeDir, dir)).sort()) {
      const afterFile = join(afterDir, dir, file);
      if (!existsSync(afterFile)) throw new Error(`Missing ${afterFile}`);
      const encode = (path: string) =>
        `data:image/png;base64,${readFileSync(path).toString('base64')}`;
      const result = await page.evaluate(
        async ([before, after]) => {
          const load = async (src: string) => {
            const image = new Image();
            image.src = src;
            await image.decode();
            return image;
          };
          const [a, b] = await Promise.all([load(before), load(after)]);
          const width = Math.max(a.width, b.width);
          const height = Math.max(a.height, b.height);
          const pixels = (image: HTMLImageElement) => {
            const canvas = new OffscreenCanvas(width, height);
            const context = canvas.getContext('2d')!;
            context.drawImage(image, 0, 0);
            return context.getImageData(0, 0, width, height).data;
          };
          const pa = pixels(a);
          const pb = pixels(b);
          const out = new OffscreenCanvas(width, height);
          const context = out.getContext('2d')!;
          const diff = context.createImageData(width, height);
          let differing = 0;
          for (let i = 0; i < pa.length; i += 4) {
            const same =
              pa[i] === pb[i] &&
              pa[i + 1] === pb[i + 1] &&
              pa[i + 2] === pb[i + 2] &&
              pa[i + 3] === pb[i + 3];
            if (same) {
              // Faded copy of the original for orientation.
              const grey =
                255 - (255 - (pa[i] + pa[i + 1] + pa[i + 2]) / 3) / 4;
              diff.data.set([grey, grey, grey, 255], i);
            } else {
              differing++;
              diff.data.set([230, 0, 60, 255], i);
            }
          }
          context.putImageData(diff, 0, 0);
          const blob = await out.convertToBlob({ type: 'image/png' });
          const bytes = new Uint8Array(await blob.arrayBuffer());
          let binary = '';
          for (const byte of bytes) binary += String.fromCharCode(byte);
          return {
            png: btoa(binary),
            width: [a.width, b.width] as [number, number],
            height: [a.height, b.height] as [number, number],
            differing,
          };
        },
        [encode(join(beforeDir, dir, file)), encode(afterFile)],
      );
      writeFileSync(
        join(diffDir, dir, file),
        Buffer.from(result.png, 'base64'),
      );
      results.push({
        dir,
        name: file.replace(/\.png$/, ''),
        width: result.width,
        height: result.height,
        differing: result.differing,
      });
    }
  }
  writeFileSync(
    join(diffDir, 'results.json'),
    `${JSON.stringify(results, null, 2)}\n`,
  );
});
