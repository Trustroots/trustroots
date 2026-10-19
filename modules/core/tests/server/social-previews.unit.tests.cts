const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const nunjucks = require('nunjucks');
const jsonForScript = require('../../server/services/json-for-script.server.service.mts');

describe('Social preview images', () => {
  const templates = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(
      path.resolve(__dirname, '../../server/views'),
    ),
  );
  templates.addFilter('jsonForScript', jsonForScript);

  for (const [label, tribe, image] of [
    [
      'circle with an image',
      { slug: 'sample-circle', image: true },
      '/uploads-circle/sample-circle/1400x900.jpg',
    ],
    ['circle without an image', { slug: 'sample-circle' }, '/img/og_image.jpg'],
    ['ordinary page', undefined, '/img/og_image.jpg'],
  ] as const) {
    it(`uses a locally hosted image for ${label}`, () => {
      const html: string = templates.render('react-layout.server.view.html', {
        hostPort: 'https://example.test',
        tribe,
        appSettings: {},
        umami: { enabled: false },
      });
      const twitterImage = html.match(
        /name="twitter:image"\s+content="([^"]+)"/,
      );
      assert.equal(twitterImage?.[1], `https://example.test${image}`);
      assert.equal(html.includes('ucarecdn.com'), false);
    });
  }
});
