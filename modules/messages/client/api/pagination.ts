export type PaginationParams = Record<string, string | string[]>;

/** Extract the next page from the API's Link header. */
export function nextPageParams(header: unknown): PaginationParams | undefined {
  // Match the previous parser's default limit on untrusted response headers.
  if (typeof header !== 'string' || !header || header.length > 2000) {
    return undefined;
  }

  let next: PaginationParams | undefined;
  for (const link of header.split(/,\s*</)) {
    const match = link.match(/<?([^>]*)>(.*)/);
    if (!match) continue;

    let url: URL;
    try {
      // Only query parameters are used; this base also accepts relative links.
      url = new URL(match[1], 'https://pagination.invalid');
    } catch {
      continue;
    }

    const values = new Map<string, string | string[]>();
    for (const [key, value] of url.searchParams) {
      const previous = values.get(key);
      values.set(
        key,
        previous === undefined
          ? value
          : Array.isArray(previous)
          ? [...previous, value]
          : [previous, value],
      );
    }
    for (const attribute of match[2].split(';').slice(1)) {
      const pair = attribute.match(/\s*(.+)\s*=\s*"?([^"]+)"?/);
      if (pair) values.set(pair[1], pair[2]);
    }

    const relation = values.get('rel');
    if (
      typeof relation === 'string' &&
      relation.split(/\s+/).includes('next')
    ) {
      values.delete('rel');
      values.delete('url');
      next = Object.fromEntries(values);
    }
  }
  return next;
}
