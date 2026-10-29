/** Support search text and import parameters must not enter request logs. */
export function redactSupportRequestUrl(url: string): string {
  const pathname = url.split('?')[0];
  return /^(\/api)?\/admin\/support(?:[/-]|$)/.test(pathname) ? pathname : url;
}
