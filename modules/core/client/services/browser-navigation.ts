export function getBrowserPath(location: Location | URL): string {
  return `${location.pathname}${location.search}${location.hash}`;
}
