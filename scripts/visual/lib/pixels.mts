// Zero-tolerance PNG comparison, done in a Chromium canvas so the harness
// needs no image library. Any channel difference in any pixel counts.
import type { Browser, Page } from '@playwright/test';

export interface PixelDiff {
  differing: number;
  width: [number, number];
  height: [number, number];
  /** Bounding box of the differing pixels, in the larger canvas. */
  box: { x: number; y: number; width: number; height: number } | null;
  /** Faded copy of the "before" image with differing pixels in red. */
  png: Buffer;
}

export class PixelComparer {
  private page: Page | null = null;

  private readonly browser: Browser;

  constructor(browser: Browser) {
    this.browser = browser;
  }

  private async ready() {
    if (!this.page) {
      this.page = await this.browser.newPage();
    }
    return this.page;
  }

  async compare(before: Buffer, after: Buffer): Promise<PixelDiff> {
    if (before.equals(after)) {
      const size = pngSize(before);
      return {
        differing: 0,
        width: [size.width, size.width],
        height: [size.height, size.height],
        box: null,
        png: before,
      };
    }
    const page = await this.ready();
    const result = await page.evaluate(
      async ([a, b]) => {
        const load = async (src: string) => {
          const image = new Image();
          image.src = src;
          await image.decode();
          return image;
        };
        const [first, second] = await Promise.all([load(a), load(b)]);
        const width = Math.max(first.width, second.width);
        const height = Math.max(first.height, second.height);
        const pixels = (image: HTMLImageElement) => {
          const canvas = new OffscreenCanvas(width, height);
          const context = canvas.getContext('2d')!;
          context.drawImage(image, 0, 0);
          return context.getImageData(0, 0, width, height).data;
        };
        const pa = pixels(first);
        const pb = pixels(second);
        const out = new OffscreenCanvas(width, height);
        const context = out.getContext('2d')!;
        const diff = context.createImageData(width, height);
        let differing = 0;
        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;
        for (let i = 0; i < pa.length; i += 4) {
          const same =
            pa[i] === pb[i] &&
            pa[i + 1] === pb[i + 1] &&
            pa[i + 2] === pb[i + 2] &&
            pa[i + 3] === pb[i + 3];
          if (same) {
            const grey = 255 - (255 - (pa[i] + pa[i + 1] + pa[i + 2]) / 3) / 4;
            diff.data.set([grey, grey, grey, 255], i);
          } else {
            differing++;
            const p = i / 4;
            const x = p % width;
            const y = Math.floor(p / width);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            diff.data.set([230, 0, 60, 255], i);
          }
        }
        context.putImageData(diff, 0, 0);
        const blob = await out.convertToBlob({ type: 'image/png' });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return {
          png: btoa(binary),
          width: [first.width, second.width] as [number, number],
          height: [first.height, second.height] as [number, number],
          differing,
          box:
            maxX < 0
              ? null
              : {
                  x: minX,
                  y: minY,
                  width: maxX - minX + 1,
                  height: maxY - minY + 1,
                },
        };
      },
      [dataUrl(before), dataUrl(after)],
    );
    return { ...result, png: Buffer.from(result.png, 'base64') };
  }

  /** Crops a PNG to a box (clamped to the image), padded by `margin`. */
  async crop(
    png: Buffer,
    box: { x: number; y: number; width: number; height: number },
    margin = 24,
  ): Promise<Buffer> {
    const page = await this.ready();
    const result = await page.evaluate(
      async ({ src, box: b, margin: m }) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const x = Math.max(0, b.x - m);
        const y = Math.max(0, b.y - m);
        const width = Math.max(1, Math.min(image.width, b.x + b.width + m) - x);
        const height = Math.max(
          1,
          Math.min(image.height, b.y + b.height + m) - y,
        );
        const canvas = new OffscreenCanvas(width, height);
        canvas.getContext('2d')!.drawImage(image, -x, -y);
        const blob = await canvas.convertToBlob({ type: 'image/png' });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return btoa(binary);
      },
      { src: dataUrl(png), box, margin },
    );
    return Buffer.from(result, 'base64');
  }
}

function dataUrl(png: Buffer) {
  return `data:image/png;base64,${png.toString('base64')}`;
}

/** Reads width and height from a PNG's IHDR chunk. */
export function pngSize(png: Buffer) {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}
