import policy from './trustroots-link-policy.json' with { type: 'json' };

/** Resolve links against the viewing origin and accept only Trustroots HTTP(S) destinations. */
export function trustrootsLink(href: string, base: string): URL | undefined {
  if (!href.trim()) return;

  try {
    const url = new URL(href, base);
    if (
      policy.schemes.includes(url.protocol.slice(0, -1)) &&
      (url.origin === new URL(base).origin ||
        url.hostname === policy.domain ||
        url.hostname.endsWith(`.${policy.domain}`))
    ) {
      return url;
    }
  } catch {
    // Invalid destinations remain plain text.
  }
}
