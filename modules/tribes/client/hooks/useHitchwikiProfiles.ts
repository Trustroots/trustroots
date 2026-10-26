import { useEffect, useMemo, useState } from 'react';
import type { CircleLocation } from '../components/CircleLocationMap';

// MediaWiki accepts at most 50 titles in a query for anonymous clients.
const BATCH_SIZE = 50;

export function useHitchwikiProfiles(
  locations: CircleLocation[],
): CircleLocation[] {
  const [profiles, setProfiles] = useState<Record<string, string | null>>({});
  const names = useMemo(
    () => [
      ...new Set(
        locations.flatMap(location =>
          (location.facts || []).flatMap(fact =>
            fact.label === 'Hitchhikers' && Array.isArray(fact.value)
              ? fact.value
                  .filter(item => item.url && !item.label.includes('|'))
                  .map(item => item.label)
              : [],
          ),
        ),
      ),
    ],
    [locations],
  );
  const pending = JSON.stringify(
    names
      .filter(name => !Object.prototype.hasOwnProperty.call(profiles, name))
      .slice(0, BATCH_SIZE),
  );

  useEffect(() => {
    const batch: string[] = JSON.parse(pending);
    if (!batch.length) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const results: Record<string, string | null> = Object.fromEntries(
      batch.map(name => [name, null]),
    );
    let disposed = false;
    const query = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      origin: '*',
      titles: batch.map(name => `User:${name}`).join('|'),
    });
    void (async () => {
      try {
        const response = await fetch(
          `https://hitchwiki.org/en/api.php?${query}`,
          {
            signal: controller.signal,
            credentials: 'omit',
          },
        );
        if (!response.ok) throw new Error('User page lookup failed');
        const data = await response.json();
        const pages: { title: string; missing?: boolean; invalid?: boolean }[] =
          data.query?.pages || [];
        const normalised: { from: string; to: string }[] =
          data.query?.normalized || [];
        for (const name of batch) {
          const title = `User:${name}`;
          const canonical =
            normalised.find(item => item.from === title)?.to || title;
          if (
            pages.some(
              page =>
                page.title === canonical && !page.missing && !page.invalid,
            )
          ) {
            results[name] =
              `https://hitchwiki.org/en/${encodeURIComponent(canonical.replace(/ /g, '_'))}`;
          }
        }
      } catch {
        // Keep Maps account links when the wiki is unavailable or times out.
      } finally {
        clearTimeout(timeout);
        if (!disposed) setProfiles(previous => ({ ...previous, ...results }));
      }
    })();
    return () => {
      disposed = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [pending]);

  return useMemo(
    () =>
      locations.map(location => ({
        ...location,
        facts: location.facts?.map(fact => ({
          ...fact,
          value:
            fact.label === 'Hitchhikers' && Array.isArray(fact.value)
              ? fact.value.map(item => ({
                  ...item,
                  ...(item.url &&
                  Object.prototype.hasOwnProperty.call(profiles, item.label) &&
                  profiles[item.label]
                    ? { url: profiles[item.label]! }
                    : {}),
                }))
              : fact.value,
        })),
      })),
    [locations, profiles],
  );
}
