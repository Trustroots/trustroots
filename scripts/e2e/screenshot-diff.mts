import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

async function pixels(file: string, width: number, height: number) {
  const { width: w = 0, height: h = 0 } = await sharp(file).metadata();
  return sharp(file)
    .ensureAlpha()
    .extend({ right: width - w, bottom: height - h, background: transparent })
    .raw()
    .toBuffer();
}

export async function diffScreenshots(
  beforeDir: string,
  afterDir: string,
  diffDir: string,
) {
  fs.mkdirSync(diffDir, { recursive: true });
  const results: Record<
    string,
    { changed: number; before: number[]; after: number[] }
  > = {};
  const files = fs.existsSync(beforeDir)
    ? fs.readdirSync(beforeDir).filter(file => file.endsWith('.png'))
    : [];
  for (const file of files.sort()) {
    const afterFile = path.join(afterDir, file);
    if (!fs.existsSync(afterFile)) continue;
    const beforeFile = path.join(beforeDir, file);
    const [b, a] = await Promise.all(
      [beforeFile, afterFile].map(f => sharp(f).metadata()),
    );
    const width = Math.max(b.width, a.width);
    const height = Math.max(b.height, a.height);
    const [old, next] = await Promise.all([
      pixels(beforeFile, width, height),
      pixels(afterFile, width, height),
    ]);
    const out = Buffer.alloc(next.length);
    let changed = 0;
    for (let i = 0; i < next.length; i += 4) {
      if (old.compare(next, i, i + 4, i, i + 4) !== 0) {
        changed++;
        out.set([255, 0, 0, 255], i);
      } else {
        const light =
          (next[i] * 0.3 + next[i + 1] * 0.59 + next[i + 2] * 0.11) / 4 + 191;
        out.fill(light, i, i + 3);
        out[i + 3] = 255;
      }
    }
    await sharp(out, { raw: { width, height, channels: 4 } })
      .png()
      .toFile(path.join(diffDir, file));
    results[file] = {
      changed: changed / (width * height),
      before: [b.width, b.height],
      after: [a.width, a.height],
    };
  }
  fs.writeFileSync(path.join(diffDir, 'diffs.json'), JSON.stringify(results));
}

if (process.argv[1] === import.meta.filename) {
  const [beforeDir, afterDir, diffDir] = process.argv.slice(2);
  await diffScreenshots(beforeDir, afterDir, diffDir);
}
