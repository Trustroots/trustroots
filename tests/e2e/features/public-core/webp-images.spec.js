/* global window, HTMLCanvasElement, CanvasRenderingContext2D, HTMLImageElement */
const { annotateFeature, expect, test } = require('../../support/fixtures');

for (const failProbe of [false, true]) {
  test(`circle images work without canvas extraction when WebP decoding ${
    failProbe ? 'fails' : 'succeeds'
  }`, async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'circles.public', [
      'Catalogue and detail pages render in the React shell.',
    ]);
    await page.addInitScript(
      ({ failProbe }) => {
        window.__canvasReads = 0;
        const blockCanvasRead = () => {
          window.__canvasReads += 1;
          throw new Error('Canvas image extraction is blocked');
        };
        HTMLCanvasElement.prototype.toDataURL = blockCanvasRead;
        HTMLCanvasElement.prototype.toBlob = blockCanvasRead;
        CanvasRenderingContext2D.prototype.getImageData = blockCanvasRead;

        window.__webPProbeCount = 0;
        window.__webPProbeState = 'pending';
        const NativeImage = window.Image;
        const src = Object.getOwnPropertyDescriptor(
          HTMLImageElement.prototype,
          'src',
        );
        window.Image = function (...args) {
          const image = new NativeImage(...args);
          Object.defineProperty(image, 'src', {
            get() {
              return src.get.call(image);
            },
            set(value) {
              if (value.startsWith('data:image/webp')) {
                window.__webPProbeCount += 1;
                image.addEventListener('load', () => {
                  window.__webPProbeState = 'loaded';
                });
                image.addEventListener('error', () => {
                  window.__webPProbeState = 'failed';
                });
                src.set.call(
                  image,
                  failProbe ? 'data:image/webp;base64,broken' : value,
                );
              } else {
                src.set.call(image, value);
              }
            },
          });
          return image;
        };
      },
      { failProbe },
    );

    const circle = {
      _id: '665200000000000000000099',
      slug: 'sample-circle',
      label: 'Sample circle',
      description: 'A fictional circle for image compatibility checks.',
      image: 'sample.jpg',
      color: '225577',
      count: 1,
      public: true,
    };
    await page.route('**/api/tribes?**', route =>
      route.fulfill({ json: [circle] }),
    );
    await page.route('**/api/tribes/sample-circle', route =>
      route.fulfill({ json: circle }),
    );
    await page.route('**/uploads-circle/sample-circle/**', route =>
      route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL0iAAAAABJRU5ErkJggg==',
          'base64',
        ),
      }),
    );

    await page.goto('/circles');
    await expect(
      page.getByRole('link', { name: /^Sample circle/ }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.__webPProbeState))
      .toBe(failProbe ? 'failed' : 'loaded');
    await page.getByRole('link', { name: /^Sample circle/ }).click();
    await expect(
      page.getByRole('heading', { name: 'Sample circle' }),
    ).toBeVisible();
    await expect(page.locator('.tribe-header')).toHaveCSS(
      'background-image',
      new RegExp(
        `/uploads-circle/sample-circle/1400x900\\.${
          failProbe ? 'jpg' : 'webp'
        }`,
      ),
    );
    expect(await page.evaluate(() => window.__webPProbeCount)).toBe(1);
    expect(await page.evaluate(() => window.__canvasReads)).toBe(0);
  });
}
