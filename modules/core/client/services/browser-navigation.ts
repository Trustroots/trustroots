export function getBrowserPath(location: Location | URL): string {
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
