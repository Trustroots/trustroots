import {
  nip19,
  verifyEvent,
  type Event,
  type EventTemplate,
  type Filter,
  type VerifiedEvent,
} from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';
import http from '@/modules/core/client/api/http-client.js';
import catalogue from './radio-catalogue.json';

export const RADIO_RELAYS = [
  'wss://relay.trustroots.org',
  'wss://relay.nomadwiki.org',
];
export const LISTENER_TTL = 12 * 60;
export const EVENT_TTL = 30 * 24 * 60 * 60;
export const FAVOURITES_KEY = 'radiostr:starred-stations:v1';
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
export function hasTag(event: Event, name: string, value: string) {
  return event.tags.some(entry => entry[0] === name && entry[1] === value);
}
export function eventType(event: Event) {
  if (event.kind !== 1 || !hasTag(event, 't', 'radiostr')) return null;
  if (hasTag(event, 't', 'nowplaying')) return 'listening';
  if (hasTag(event, 't', 'favorite')) return 'favourite';
  return 'chat';
}
export function roomTemplate(
  type: 'chat' | 'listening' | 'favourite',
  station: Station | undefined,
  content: string,
  starred = true,
  now = Math.floor(Date.now() / 1000),
): EventTemplate {
  const tags = [
    ['t', 'radiostr'],
    ['expiration', String(now + EVENT_TTL)],
  ];
  if (type === 'chat') {
    if (station) tags.push(['channel', station.id]);
  } else {
    tags.push(
      ['t', type === 'listening' ? 'nowplaying' : 'favorite'],
      ['client', 'radiostr'],
      ['radiostr_station', station!.id],
    );
    if (type === 'favourite')
      tags.push(
        ['radiostr_action', starred ? 'star' : 'unstar'],
        ['radiostr_title', station!.title],
      );
  }
  return { kind: 1, created_at: now, tags, content };
}
export function activeListeners(
  events: Event[],
  now = Math.floor(Date.now() / 1000),
) {
  const latest = new Map<string, Event>();
  events.forEach(event => {
    if (
      eventType(event) !== 'listening' ||
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
export function mergeFavourites(local: string[], events: Event[]) {
  const latest = new Map<string, Event>();
  [...events]
    .sort((a, b) => a.created_at - b.created_at || b.id.localeCompare(a.id))
    .forEach(event => {
      const id = tag(event, 'radiostr_station');
      if (eventType(event) === 'favourite' && id) latest.set(id, event);
    });
  return [
    ...new Set([
      ...[...latest]
        .filter(
          ([, event]) =>
            tag(event, 'radiostr_action') !== 'unstar' &&
            !(
              tag(event, 'radiostr_action') !== 'star' &&
              event.content.startsWith('☆')
            ),
        )
        .map(([id]) => id),
      ...local.filter(id => !latest.has(id)),
    ]),
  ].filter(id => stations.some(station => station.id === id));
}
export function readFavourites(key = FAVOURITES_KEY): string[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(ids) ? mergeFavourites(ids, []) : [];
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

export interface RadioSigner {
  publicKey: string;
  sign(template: EventTemplate): Promise<VerifiedEvent>;
}
export async function connectRadioSigner(user: {
  username: string;
  nostrNpub?: string;
}): Promise<RadioSigner> {
  const provider = window.nostr;
  if (!provider?.getPublicKey || !provider.signEvent)
    throw new Error('Connect a Nostr extension to participate.');
  if (!user.nostrNpub)
    throw new Error('Link your Nostr key in profile settings first.');
  const decoded = nip19.decode(user.nostrNpub);
  const publicKey = (await provider.getPublicKey()).toLowerCase();
  const { data } = await http.get('/.well-known/nostr.json', {
    params: { name: user.username },
  });
  if (
    decoded.type !== 'npub' ||
    decoded.data !== publicKey ||
    data?.names?.[user.username] !== publicKey
  )
    throw new Error(
      'Your Nostr signer must match this account’s verified @trustroots.org identity.',
    );
  return {
    publicKey,
    async sign(template) {
      if (
        window.nostr !== provider ||
        (await provider.getPublicKey!()).toLowerCase() !== publicKey
      )
        throw new Error('Your Nostr signer changed. Connect it again.');
      const response = (await provider.signEvent!({
        ...template,
        tags: template.tags.map(entry => [...entry]),
      })) as unknown as Event;
      // Reconstruct the wire event, excluding library verification-cache symbols.
      const event: Event = {
        id: response.id,
        sig: response.sig,
        pubkey: response.pubkey,
        kind: response.kind,
        content: response.content,
        created_at: response.created_at,
        tags: response.tags,
      };
      if (
        event.pubkey !== publicKey ||
        event.kind !== template.kind ||
        event.content !== template.content ||
        event.created_at !== template.created_at ||
        JSON.stringify(event.tags) !== JSON.stringify(template.tags) ||
        !verifyEvent(event)
      )
        throw new Error('The signer returned an unexpected event.');
      return event as VerifiedEvent;
    },
  };
}

export class RadioRoom {
  private relays: Relay[] = [];
  private subscriptions: { close(): void }[] = [];
  private closed = false;
  private signer?: RadioSigner;
  private favouritePublicKey?: string;
  constructor(
    private onEvent: (event: Event) => void,
    private onError: () => void,
  ) {}

  async open(loggedIn: boolean) {
    const filters: Filter[] = loggedIn
      ? [
          {
            kinds: [1],
            '#t': ['radiostr'],
            since: Math.floor(Date.now() / 1000) - EVENT_TTL,
            limit: 500,
          },
        ]
      : [
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
          this.configureAuth(relay);
          this.subscriptions.push(
            relay.subscribe(filters, {
              onevent: event => {
                const now = Math.floor(Date.now() / 1000);
                if (
                  !this.closed &&
                  eventType(event) &&
                  (loggedIn || eventType(event) === 'listening') &&
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
          if (this.favouritePublicKey)
            this.subscribeFavourites(relay, this.favouritePublicKey);
        } catch {
          relay.close();
        }
      }),
    );
    if (!this.closed && !this.relays.length) this.onError();
  }
  private configureAuth(relay: Relay) {
    relay.onauth = this.signer
      ? template => this.signer!.sign(template)
      : undefined;
  }
  setSigner(signer: RadioSigner) {
    this.signer = signer;
    this.relays.forEach(relay => this.configureAuth(relay));
  }
  loadFavourites(publicKey: string) {
    this.favouritePublicKey = publicKey;
    this.relays.forEach(relay => this.subscribeFavourites(relay, publicKey));
  }
  private subscribeFavourites(relay: Relay, publicKey: string) {
    this.subscriptions.push(
      relay.subscribe(
        [
          {
            kinds: [1],
            authors: [publicKey],
            '#t': ['favorite'],
            since: Math.floor(Date.now() / 1000) - EVENT_TTL,
            limit: 500,
          },
        ],
        {
          onevent: event => {
            if (!this.closed && eventType(event) === 'favourite')
              this.onEvent(event);
          },
        },
      ),
    );
  }
  async publish(template: EventTemplate) {
    if (this.closed || !this.signer)
      throw new Error('Connect your matching Nostr identity first.');
    const event = await this.signer.sign(template);
    if (this.closed) throw new Error('The radio room has closed.');
    const results = await Promise.allSettled(
      this.relays.map(relay => relay.publish(event)),
    );
    if (!results.some(result => result.status === 'fulfilled'))
      throw new Error('Could not publish to the radio room. Try again.');
    this.onEvent(event);
  }
  close() {
    this.closed = true;
    this.subscriptions.forEach(subscription => subscription.close());
    this.relays.forEach(relay => relay.close());
    this.relays = [];
  }
}
