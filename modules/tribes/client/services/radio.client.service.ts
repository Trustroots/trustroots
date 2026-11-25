import type { Event, Filter } from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';
import http from '@trustroots/core/http-client';
import catalogue from './radio-catalogue.json';

export const RADIO_RELAYS = [
  'wss://relay.trustroots.org',
  'wss://relay.nomadwiki.org',
];
export const LISTENER_TTL = 12 * 60;
export const FAVOURITES_KEY = 'radiostr:starred-stations:v1';

export async function fetchRadioAuthorUsernames(
  pubkeys: string[],
  signal: AbortSignal,
): Promise<Record<string, string>> {
  const batches = [];
  for (let index = 0; index < pubkeys.length; index += 100) {
    const query = new URLSearchParams({ profiles: '1' });
    pubkeys
      .slice(index, index + 100)
      .forEach(key => query.append('pubkey', key));
    batches.push(
      http
        .get<{ usernames?: Record<string, string> }>(
          `/api/nostr/author-visibility?${query}`,
          { signal },
        )
        .then(({ data }) => data.usernames),
    );
  }
  return Object.assign({}, ...(await Promise.all(batches)));
}

export interface Station {
  id: string;
  title: string;
  url: string;
  tags: string[];
  site?: string;
  img?: string;
}
interface CatalogueEntry {
  name?: string;
  url?: string;
  tags: string[];
  site?: string;
  img?: string;
}
// Catalogue snapshot from Trustroots/nostroots examples/radiostr/channels.js.
// Preserve IDs: they are used in shared room events and station links.
export const stations: Station[] = Object.entries(catalogue.channels).map(
  ([id, raw]) => {
    const entry: CatalogueEntry = raw;
    return {
      ...entry,
      id,
      title:
        entry.name ||
        id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      url:
        entry.url ||
        `https://ice1.somafm.com/${encodeURIComponent(id)}-128-mp3`,
    };
  },
);
export const stationGroups = [...catalogue.sections]
  .sort((a, b) => a.order - b.order)
  .map(group => ({
    name: group.name,
    stations: stations.filter(station =>
      station.tags.some(tag => group.tags.includes(tag)),
    ),
  }));

export function stationFromHash(hash: string) {
  return stations.find(
    station => station.id === hash.replace(/^#/, '').split(/[/?#]/)[0],
  );
}
export function tag(event: Event, name: string) {
  return event.tags.find(entry => entry[0] === name)?.[1];
}
function isListeningEvent(event: Event) {
  return (
    event.kind === 1 &&
    event.tags.some(([name, value]) => name === 't' && value === 'radiostr') &&
    event.tags.some(([name, value]) => name === 't' && value === 'nowplaying')
  );
}

export function activeListeners(
  events: Event[],
  now = Math.floor(Date.now() / 1000),
) {
  const latest = new Map<string, Event>();
  events.forEach(event => {
    if (
      !isListeningEvent(event) ||
      !tag(event, 'radiostr_station') ||
      event.created_at > now + 60 ||
      event.created_at < now - LISTENER_TTL ||
      Number(tag(event, 'expiration') || Infinity) <= now
    )
      return;
    const previous = latest.get(event.pubkey);
    if (
      !previous ||
      event.created_at > previous.created_at ||
      (event.created_at === previous.created_at && event.id < previous.id)
    )
      latest.set(event.pubkey, event);
  });
  return [...latest.values()].sort((a, b) => b.created_at - a.created_at);
}
export function readFavourites(key = FAVOURITES_KEY): string[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(ids)) return [];
    return [...new Set(ids)].filter(id =>
      stations.some(station => station.id === id),
    );
  } catch {
    return [];
  }
}
export function saveFavourites(ids: string[], key = FAVOURITES_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* Listening works without storage. */
  }
}

export class RadioRoom {
  private relays: Relay[] = [];
  private subscriptions: { close(): void }[] = [];
  private closed = false;
  constructor(
    private onEvent: (event: Event) => void,
    private onError: () => void,
  ) {}

  async open() {
    const filters: Filter[] = [
      {
        kinds: [1],
        '#t': ['nowplaying'],
        since: Math.floor(Date.now() / 1000) - LISTENER_TTL,
        limit: 500,
      },
    ];
    await Promise.all(
      RADIO_RELAYS.map(async url => {
        const relay = new Relay(url);
        relay.onclose = () => {
          this.relays = this.relays.filter(item => item !== relay);
          if (!this.closed && !this.relays.length) this.onError();
        };
        try {
          await relay.connect({ timeout: 5000 });
          if (this.closed) {
            relay.close();
            return;
          }
          this.relays.push(relay);
          this.subscriptions.push(
            relay.subscribe(filters, {
              onevent: event => {
                const now = Math.floor(Date.now() / 1000);
                if (
                  !this.closed &&
                  isListeningEvent(event) &&
                  event.created_at <= now + 60 &&
                  Number(tag(event, 'expiration') || Infinity) > now
                )
                  this.onEvent(event);
              },
              onclose: () => {
                if (!this.closed) this.onError();
              },
            }),
          );
        } catch {
          relay.close();
        }
      }),
    );
    if (!this.closed && !this.relays.length) this.onError();
  }
  close() {
    this.closed = true;
    this.subscriptions.forEach(subscription => subscription.close());
    this.relays.forEach(relay => relay.close());
    this.relays = [];
  }
}
