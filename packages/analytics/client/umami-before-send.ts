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
/** The `window` property named by `data-before-send` in the page layout. */
export const UMAMI_BEFORE_SEND = 'trUmamiBeforeSend';

/** The fields of an Umami payload this hook reads or rewrites. */
export type UmamiPayload = {
  url?: string;
  referrer?: string;
  [field: string]: unknown;
};

/** The app route template for a path, or nothing for unknown paths. */
export type RouteTemplate = (pathname: string) => string | undefined;

const NOT_FOUND_TEMPLATE = '/not-found';
const ABSOLUTE_URL = /^[a-z][a-z\d+.-]*:/i;

/**
 * Turn a page address into its route template. Same-site addresses keep their
 * shape (absolute or path-only); other sites keep only their origin.
 */
export function scrubUmamiUrl(
  value: string | undefined,
  routeTemplate: RouteTemplate,
): string | undefined {
  if (!value) return value;

  const { origin } = window.location;
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return '';
  }

  if (url.origin !== origin) return url.origin;

  const template = routeTemplate(url.pathname) ?? NOT_FOUND_TEMPLATE;
  return ABSOLUTE_URL.test(value) ? `${origin}${template}` : template;
}

function globalPrivacyControlEnabled(): boolean {
  return (
    (window.navigator as { globalPrivacyControl?: unknown })
      .globalPrivacyControl === true
  );
}

export function createUmamiBeforeSend(routeTemplate: RouteTemplate) {
  return function umamiBeforeSend(
    _type: string,
    payload: UmamiPayload,
  ): UmamiPayload | null {
    if (globalPrivacyControlEnabled()) return null;

    const scrubbed = { ...payload };
    if ('url' in payload) {
      scrubbed.url = scrubUmamiUrl(payload.url, routeTemplate);
    }
    if ('referrer' in payload) {
      scrubbed.referrer = scrubUmamiUrl(payload.referrer, routeTemplate);
    }
    return scrubbed;
  };
}

/** Install the hook, then activate the tracker from the page template. */
export function installUmamiBeforeSend(routeTemplate: RouteTemplate): void {
  (window as unknown as Record<string, unknown>)[UMAMI_BEFORE_SEND] =
    createUmamiBeforeSend(routeTemplate);

  const template =
    document.querySelector<HTMLTemplateElement>('#tr-umami-tracker');
  if (template) {
    template.replaceWith(template.content.cloneNode(true));
  }
}
