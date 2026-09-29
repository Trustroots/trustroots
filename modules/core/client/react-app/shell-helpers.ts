export function signout(event?: { preventDefault: () => void }) {
  if (event) {
    event.preventDefault();
  }

  if (window.postMessage) {
    window.postMessage(
      'unAuthenticated',
      `${window.location.protocol}//${window.location.host}`,
    );
  }

  if (window.isNativeMobileApp && window.postMessage) {
    window.postMessage(JSON.stringify({ action: 'unAuthenticated' }));
  }

  window.top!.location.href = '/api/auth/signout';
}

function getBrowserPath(location: Location | URL): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function navigateTo(
  url: string,
  location = window.location,
  history = location === window.location ? window.history : null,
  dispatchEvent = (event: Event) => window.dispatchEvent(event),
) {
  const destination = new URL(url, location.href || window.location.href);

  if (
    history &&
    destination.origin === location.origin &&
    getBrowserPath(destination) !== getBrowserPath(location)
  ) {
    history.pushState({}, '', getBrowserPath(destination));
    dispatchEvent(new PopStateEvent('popstate'));
    return;
  }

  if (
    history &&
    destination.origin === location.origin &&
    getBrowserPath(destination) === getBrowserPath(location)
  ) {
    return;
  }

  if (typeof location.assign === 'function') {
    location.assign(url);
    return;
  }

  location.href = url;
}

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

export const navigation = {
  go(url: string) {
    navigateTo(url);
  },
};

export function defaultNavigate(url: string) {
  navigation.go(url);
}
