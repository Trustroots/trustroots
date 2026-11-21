import { expect } from 'vitest';
import index from './../../server/views/index.mts';

/**
 * The exact HTML of the per-request head. Run with `-u` to accept an
 * intended change.
 */

const locals = {
  title: 'Trustroots',
  description: 'Travellers & "hosts"',
  hostPort: 'https://example.test',
  canonicalUrl: 'https://example.test/search',
  nonce: 'test-nonce',
  twitterUsername: '@example',
  umami: {
    scriptSrc: 'https://stats.example.test/script.js?a&b',
    websiteId: 'site-"1"',
  },
  appSettings: { commit: 'abc1234' },
  env: 'test',
  isNativeMobileApp: false,
  user: { displayName: '</script><b>' },
};
const tribe = { label: 'Hitch "hikers" <b>&</b>', slug: 'hitch', image: true };

const lines = (pattern: RegExp) => (html: string) =>
  html
    .split('\n')
    .filter(line => pattern.test(line))
    .join('\n');

// Each page with the part of it the case pins; the full page when absent.
const pages: Record<string, [() => string, ((html: string) => string)?]> = {
  index: [() => index(locals)],
  'index-invite': [
    () =>
      index({
        ...locals,
        invite: true,
        isNativeMobileApp: true,
        twitterUsername: undefined,
        umami: { ...locals.umami, enabled: false },
      }),
    lines(/og:title|twitter:site|template|<script/),
  ],
  'index-circle': [
    () => index({ ...locals, tribe }),
    lines(/title|og:|twitter:/),
  ],
  'index-circle-without-image': [
    () => index({ ...locals, tribe: { ...tribe, image: false } }),
    lines(/image/),
  ],
};

describe('Start shell head', function () {
  for (const [name, [render, pick = String]] of Object.entries(pages)) {
    it(`renders ${name}`, async function () {
      // Not .html: Stryker rewrites script elements in HTML files.
      await expect(pick(render().replace(/></g, '>\n<'))).toMatchFileSnapshot(
        `./__snapshots__/views/${name}.snap`,
      );
    });
  }
});
