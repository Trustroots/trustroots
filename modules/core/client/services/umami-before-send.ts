/**
 * Umami's `data-before-send` hook. The tracker script calls
 * `window.trUmamiBeforeSend(type, payload)` before every page view, event and
 * Web Vitals report. Page addresses on Trustroots name members and carry
 * secret tokens (`/profile/<username>`, `/password/reset/<token>`,
 * `?secret=…`), so the hook replaces the page address and the referrer with
 * the matched route template (`/profile/:username`) and drops query strings
 * and hashes. It sends nothing when the browser asks for Global Privacy
 * Control; the tracker itself already honours Do-Not-Track.
 */
import { matchReactRoute } from '@/modules/core/shared/react-route-ownership.mts';

/** The `window` property named by `data-before-send` in the page layout. */
export const UMAMI_BEFORE_SEND = 'trUmamiBeforeSend';

/** The fields of an Umami payload this hook reads or rewrites. */
export type UmamiPayload = {
  url?: string;
  referrer?: string;
  [field: string]: unknown;
};

const NOT_FOUND_TEMPLATE = '/not-found';
const ABSOLUTE_URL = /^[a-z][a-z\d+.-]*:/i;

function routeTemplate(pathname: string): string {
  return matchReactRoute(pathname)?.policy.path ?? NOT_FOUND_TEMPLATE;
}

/**
 * Turn a page address into its route template. Same-site addresses keep their
 * shape (absolute or path-only); other sites keep only their origin.
 */
export function scrubUmamiUrl(value: string | undefined): string | undefined {
  if (!value) return value;

  const { origin } = window.location;
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return '';
  }

  if (url.origin !== origin) return url.origin;

  const template = routeTemplate(url.pathname);
  return ABSOLUTE_URL.test(value) ? `${origin}${template}` : template;
}

function globalPrivacyControlEnabled(): boolean {
  return (
    (window.navigator as { globalPrivacyControl?: unknown })
      .globalPrivacyControl === true
  );
}

export function umamiBeforeSend(
  _type: string,
  payload: UmamiPayload,
): UmamiPayload | null {
  if (globalPrivacyControlEnabled()) return null;

  const scrubbed = { ...payload };
  if ('url' in payload) scrubbed.url = scrubUmamiUrl(payload.url);
  if ('referrer' in payload) {
    scrubbed.referrer = scrubUmamiUrl(payload.referrer);
  }
  return scrubbed;
}

/** Expose the hook before the tracker sends its first page view. */
export function installUmamiBeforeSend(): void {
  (window as unknown as Record<string, unknown>)[UMAMI_BEFORE_SEND] =
    umamiBeforeSend;
}
