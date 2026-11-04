/**
 * Remembers, for the current browser tab, where reaching out to a member
 * started, so the first message or contact request can say so.
 *
 * The username stays in this tab's `sessionStorage` to match the later send
 * to the same member; it is never sent to Umami. Only the source is.
 */
import type { OutreachSource } from '../shared/events.ts';

const STORAGE_KEY = 'tr.analytics.outreach';

/** A later, more specific start does not replace an earlier, broader one. */
const RANK: Record<OutreachSource, number> = {
  other: 0,
  profile: 1,
  offer: 2,
  search: 3,
};

type Stored = { username: string; source: OutreachSource };

function read(): Stored | null {
  try {
    const value = JSON.parse(
      window.sessionStorage.getItem(STORAGE_KEY) ?? 'null',
    ) as Partial<Stored> | null;
    return typeof value?.username === 'string' &&
      typeof value.source === 'string' &&
      value.source in RANK
      ? (value as Stored)
      : null;
  } catch {
    // Storage is unavailable or holds something else.
    return null;
  }
}

/**
 * Note that the member is on their way to reach out to `username` from
 * `source`. Search beats the offer button, which beats the profile, so
 * "search result, then profile, then message" stays `search`.
 */
export function rememberOutreachSource(
  username: string | undefined,
  source: Exclude<OutreachSource, 'other'>,
): void {
  if (!username) return;
  const current = read();
  if (current?.username === username && RANK[current.source] >= RANK[source]) {
    return;
  }
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ username, source }),
    );
  } catch {
    // Storage is full or blocked; the send is then counted as `other`.
  }
}

/** Where reaching out to `username` started, or `other` if unknown. */
export function readOutreachSource(
  username: string | undefined,
): OutreachSource {
  const current = read();
  return current && current.username === username ? current.source : 'other';
}
