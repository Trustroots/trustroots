import assert from 'node:assert/strict';
import index from './../../server/views/index.mts';

describe('Social preview images', () => {
  for (const [label, tribe, image] of [
    [
      'circle with an image',
      { label: 'Sample', slug: 'sample-circle', image: true },
      '/uploads-circle/sample-circle/1400x900.jpg',
    ],
    [
      'circle without an image',
      { label: 'Sample', slug: 'sample-circle' },
      '/img/og_image.jpg',
    ],
    ['ordinary page', undefined, '/img/og_image.jpg'],
  ] as const) {
    it(`uses a locally hosted image for ${label}`, () => {
      const html = index({
        hostPort: 'https://example.test',
        tribe,
        appSettings: {},
        umami: { enabled: false, scriptSrc: '', websiteId: '' },
      } as unknown as Parameters<typeof index>[0]);
      const twitterImage = html.match(
        /name="twitter:image"\s+content="([^"]+)"/,
      );
      const openGraphImage = html.match(
        /property="og:image"\s+content="([^"]+)"/,
      );
      const expectedImage = `https://example.test${image}`;
      assert.equal(twitterImage?.[1], expectedImage);
      assert.equal(openGraphImage?.[1], expectedImage);
    });
  }
});
