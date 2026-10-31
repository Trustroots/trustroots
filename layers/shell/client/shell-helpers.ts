import { getBrowserPath } from '@/modules/core/client/services/browser-navigation';

export function getClientNavigationTarget(
  event: MouseEvent,
  location: Location = window.location,
) {
  if (
    event.defaultPrevented ||
    (event.button !== undefined && event.button !== 0) ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return null;
  }

  const eventTarget = event.target;
  const anchor =
    eventTarget instanceof HTMLAnchorElement
      ? eventTarget
      : eventTarget instanceof Element
        ? (eventTarget.closest('a[href]') as HTMLAnchorElement | null)
        : null;

  if (
    !anchor ||
    anchor.hasAttribute('download') ||
    (anchor.target && anchor.target !== '_self') ||
    anchor.relList?.contains('external')
  ) {
    return null;
  }

  const href = anchor.getAttribute('href');

  if (!href || href.includes('#')) {
    return null;
  }

  const destination = new URL(href, location.href);

  if (
    destination.origin !== location.origin ||
    !['http:', 'https:'].includes(destination.protocol)
  ) {
    return null;
  }

  return getBrowserPath(destination);
}
