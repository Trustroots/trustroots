import assert from 'node:assert/strict';
import path from 'node:path';
import nunjucksModule from 'nunjucks';
import jsonForScript from './../../server/services/json-for-script.server.service.mts';

const nunjucks = nunjucksModule as unknown as {
  Environment: new (loader: unknown) => {
    addFilter(name: string, filter: (value: unknown) => string): void;
    render(template: string, context: object): string;
  };
  FileSystemLoader: new (searchPath: string) => unknown;
};

describe('Social preview images', () => {
  const templates = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(
      path.resolve(import.meta.dirname, '../../server/views'),
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
