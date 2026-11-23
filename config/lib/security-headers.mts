import { FEATURED_NOTE_RELAYS } from '../../modules/core/shared/featured-nostr-notes.mts';

/**
 * Security response headers: CSP with a per-request nonce, HSTS, nosniff
 * and frame protection.
 */
export function securityHeaders(
  nonce: string,
  env = process.env.NODE_ENV,
): Record<string, string> {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      // Only the development bundle uses eval-based source maps.
      ...(env === 'production' ? [] : ["'unsafe-eval'"]),
      "'self'",
      'https://1p.trustroots.org', // Umami analytics
      `'nonce-${nonce}'`,
    ],
    'script-src-attr': ["'none'"],
    'font-src': ["'self'", 'data:'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': [
      "'self'",
      // Official radio artwork used for links to broadcaster websites.
      'https://somafm.com/img/',
      'https://radioparadise.com/apple-touch-icon.png',
      'https://*.tiles.mapbox.com',
      'https://api.mapbox.com',
      'https://events.mapbox.com',
      '*.tile.openstreetmap.org',
      '*.earthdata.nasa.gov',
      '*.twitter.com',
      '*.gstatic.com',
      '*.googleusercontent.com', // Google CDN. Android app related.
      'gravatar.com',
      'i0.wp.com',
      'i1.wp.com',
      'i2.wp.com',
      'data:',
      'blob:', // mapbox-gl
    ],
    'connect-src': [
      "'self'",
      'https://api.mapbox.com',
      'https://events.mapbox.com',
      'https://fonts.openmaptiles.org',
      'https://tile.openstreetmap.org',
      ...FEATURED_NOTE_RELAYS,
      'wss://relay.maps.hitchwiki.org',
      'wss:', // Member-selected NIP-46 signer relays.
      'https://1p.trustroots.org', // Umami analytics
    ],
    'object-src': ["'none'"],
    // Radio station URLs can redirect to HTTPS streaming CDN hosts.
    'media-src': ["'self'", 'https:'],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'child-src': ["'self'", 'blob:'],
    'worker-src': ["'self'", 'blob:'],
    'base-uri': ["'self'"],
    // See `modules/core/server/routes/core.server.routes.mts`.
    'report-uri': ['/api/report-csp-violation'],
    'upgrade-insecure-requests': [],
  };
  const policy = Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(' '))
    .join('; ');

  return {
    // Report-only in development, so violations are logged but not blocked.
    [env === 'development'
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy']: policy,
    'Strict-Transport-Security': 'max-age=15778476',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
  };
}
