import { createElement as h, Fragment, type ReactNode } from 'react';
import * as he from 'he';
import { plainText } from '../services/text.server.service.mts';

/**
 * The merged app, response and render locals Express passes to a view (see
 * `initViewEngine` in config/lib/express).
 */
export interface PageLocals {
  title: string;
  description: string;
  hostPort: string;
  canonicalUrl: string;
  nonce: string;
  twitterUsername?: string;
  umami: { enabled?: boolean; scriptSrc: string; websiteId: string };
  tribe?: { label: string; slug: string; image?: boolean };
  invite?: boolean;
}

const icons = [512, 192, 144, 96, 72, 48];
const touchIcons: Array<[string, string]> = [
  ['152x152', 'Icon-76@2x.png'],
  ['120x120', 'Icon-60@2x.png'],
  ['76x76', 'Icon-76.png'],
  ['60x60', 'Icon-60.png'],
  ['144x144', 'Icon-72@2x.png'],
  ['114x114', 'Icon@2x.png'],
  ['72x72', 'Icon-72.png'],
];

function socialMeta(attribute: 'property' | 'name', prefix: string) {
  return (key: string, content: string) =>
    h('meta', { [attribute]: `${prefix}:${key}`, content });
}

/** Title, icons and social preview tags shared by every page. */
export function Head(locals: PageLocals): ReactNode {
  const { hostPort, title, description, tribe, umami } = locals;
  const og = socialMeta('property', 'og');
  const twitter = socialMeta('name', 'twitter');
  const label = tribe && plainText(tribe.label);
  const circle = label?.replaceAll('"', "'");
  const image = tribe?.image
    ? `${hostPort}/uploads-circle/${tribe.slug}/1400x900.jpg`
    : `${hostPort}/img/og_image.jpg`;
  const circleDescription = `Join to meet, host and get hosted by Trustroots circle ${circle}. Trustroots is a travellers' community for sharing, hosting and getting people together.`;
  return h(
    Fragment,
    null,
    h('meta', { charSet: 'utf-8' }),
    h('meta', { httpEquiv: 'X-UA-Compatible', content: 'IE=edge,chrome=1' }),
    h('meta', {
      name: 'viewport',
      content: 'width=device-width, initial-scale=1, maximum-scale=1',
    }),
    h('title', null, tribe ? `${label} - Trustroots circle` : title),
    h('base', { href: '/' }),
    h('meta', { name: 'fragment', content: '!' }),
    umami.enabled !== false &&
      h('template', {
        id: 'tr-umami-tracker',
        // React would hoist a script element out of the template.
        dangerouslySetInnerHTML: {
          __html: `<script async src="${he.escape(umami.scriptSrc)}" data-website-id="${he.escape(umami.websiteId)}" data-do-not-track="true" data-performance="true" data-exclude-search="true" data-exclude-hash="true" data-before-send="trUmamiBeforeSend" nonce="${he.escape(locals.nonce)}"></script>`,
        },
      }),
    h('link', { rel: 'dns-prefetch', href: '//api.tiles.mapbox.com' }),
    h('link', { rel: 'dns-prefetch', href: '//gravatar.com' }),
    h('meta', { name: 'description', content: description }),
    h('meta', { name: 'application-name', content: title }),
    h('meta', { name: 'mobile-web-app-capable', content: 'yes' }),
    h('meta', { name: 'theme-color', content: '#12b591' }),
    h('link', { rel: 'manifest', href: '/manifest.json' }),
    ...icons.map(size =>
      h('link', {
        rel: 'icon',
        type: 'image/png',
        href: `${hostPort}/img/icons/android/${size}.png`,
        sizes: `${size}x${size}`,
      }),
    ),
    h('link', {
      rel: 'icon shortcut',
      type: 'image/png',
      href: `${hostPort}/img/favicon@2x.png`,
      sizes: '32x32',
      id: 'favicon2x',
    }),
    h('link', {
      rel: 'icon shortcut',
      type: 'image/png',
      href: `${hostPort}/img/favicon.png`,
      sizes: '16x16',
      id: 'favicon',
    }),
    h('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }),
    h('meta', {
      name: 'apple-mobile-web-app-status-bar-style',
      content: 'black',
    }),
    ...touchIcons.map(([sizes, file]) =>
      h('link', {
        rel: 'apple-touch-icon-precomposed',
        sizes,
        href: `${hostPort}/img/icons/ios/${file}`,
      }),
    ),
    h('link', {
      rel: 'apple-touch-icon',
      sizes: '57x57',
      href: `${hostPort}/img/icons/ios/Icon.png`,
    }),
    tribe
      ? h(
          Fragment,
          null,
          og('title', `Join ${circle} on Trustroots circle`),
          og('description', circleDescription),
          og('url', `${hostPort}/circles/${tribe.slug}`),
        )
      : h(
          Fragment,
          null,
          og(
            'title',
            locals.invite ? 'You are invited to join Trustroots!' : title,
          ),
          og('description', description),
          og('url', locals.canonicalUrl),
        ),
    og('image', image),
    og('image:width', '1400'),
    og('image:height', tribe?.image ? '900' : '735'),
    og('site_name', title),
    og('type', 'website'),
    og('locale', 'en_GB'),
    locals.twitterUsername && twitter('site', locals.twitterUsername),
    tribe
      ? h(
          Fragment,
          null,
          twitter('card', 'summary_large_image'),
          twitter('title', `Join ${circle} on Trustroots`),
          twitter('description', circleDescription),
          twitter('url', `${hostPort}/circles/${tribe.slug}`),
        )
      : h(
          Fragment,
          null,
          twitter('title', title),
          twitter('description', description),
          twitter('url', `${hostPort}/`),
        ),
    twitter('image', image),
    h('meta', { name: 'msapplication-tap-highlight', content: 'no' }),
    h('meta', { name: 'msapplication-TileColor', content: '#FFFFFF' }),
    h('meta', {
      name: 'msapplication-TileImage',
      content: `${hostPort}/img/icons/apple-touch-icon-144x144-precomposed.png`,
    }),
  );
}
