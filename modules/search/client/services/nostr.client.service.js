/* eslint-disable angular/log */

// nostr-tools v2 exposes subpaths via the package.json `exports` map, which
// webpack 4 can't resolve, so import the CJS build file directly.
import { Relay } from 'nostr-tools/lib/cjs/relay.js';

export const NOSTR_RELAY_URL = 'wss://relay.trustroots.org';
export const MAP_NOTES_LIMIT = 500;

// Nostroots validation server pubkey — only kind 30398 events signed by this
// key are considered verified map notes.
export const NOSTROOTS_VALIDATION_PUBKEY =
  'f5bc71692fc08ea52c0d1c8bcfb87579584106b5feb4ea542b1b8a95612f257b';

export function getNostrEventAuthorPubkey(event) {
  if (event?.kind === 30398) {
    const originalAuthorTag = event.tags?.find(tag => tag[0] === 'p' && tag[1]);
    if (originalAuthorTag) {
      return originalAuthorTag[1];
    }
  }

  return event?.pubkey;
}

function getReferencedEventIds(event) {
  return (event.tags ?? [])
    .filter(tag => tag[0] === 'e' && tag[1])
    .map(tag => tag[1]);
}

/**
 * NostrService — manages WebSocket relay connection and Nostr subscriptions.
 * Framework-agnostic; consumed by React components.
 */
export default class NostrService {
  /**
   * @param {string} relayUrl — WebSocket URL of the Nostr relay
   */
  constructor(relayUrl) {
    this.relayUrl = relayUrl;
    this.relay = null;
    this.subscriptions = new Map();
    this.usernameCache = new Map();
  }

  /**
   * Lazy-connect to the relay. Returns the existing relay if already connected.
   * @returns {Promise<Relay>}
   */
  async connect() {
    if (this.relay && this.relay.connected !== false) {
      return this.relay;
    }
    const relay = new Relay(this.relayUrl);
    await relay.connect();
    relay.onclose = () => {
      if (this.relay === relay) {
        this.relay = null;
      }
      this.subscriptions.clear();
    };
    this.relay = relay;
    return this.relay;
  }

  /**
   * Close all subscriptions, clear the subscription map, close the relay.
   */
  disconnect() {
    for (const sub of this.subscriptions.values()) {
      sub.close();
    }
    this.subscriptions.clear();

    if (this.relay) {
      this.relay.close();
      this.relay = null;
    }
  }

  /**
   * Close only the map notes subscription, leaving the relay open for other
   * consumers (profile badge, username resolution).
   */
  unsubscribeMapNotes() {
    const existing = this.subscriptions.get('mapNotes');
    if (existing) {
      existing.close();
      this.subscriptions.delete('mapNotes');
    }
  }

  /**
   * Subscribe to recent verified map notes (kind 30398) from the Nostroots
   * validation server.
   * Closes any existing 'mapNotes' subscription before creating a new one.
   *
   * @param {Function} onEvent — callback invoked for each matching event
   * @param {number} [limit=MAP_NOTES_LIMIT] — maximum historical events
   * @returns {Promise<object>} the subscription handle
   */
  async subscribeMapNotes(onEvent, limit = MAP_NOTES_LIMIT) {
    const relay = await this.connect();

    this.unsubscribeMapNotes();

    const sub = relay.subscribe(
      [
        {
          kinds: [30398],
          authors: [NOSTROOTS_VALIDATION_PUBKEY],
          limit,
        },
      ],
      {
        onevent: onEvent,
        oneose() {},
      },
    );

    this.subscriptions.set('mapNotes', sub);
    return sub;
  }

  /**
   * One-shot query for map note events by a given author.
   * Resolves with events sorted by created_at descending when EOSE is received.
   *
   * @param {string} pubkeyHex — hex-encoded public key
   * @param {number} [limit=3] — maximum number of events to fetch
   * @returns {Promise<object[]>} events sorted by created_at desc
   */
  async fetchUserNotes(pubkeyHex, limit = 3) {
    const relay = await this.connect();
    const events = [];

    return new Promise(resolve => {
      const subscriptionRef = { current: null };
      let resolved = false;

      const finish = () => {
        if (resolved) {
          return;
        }
        resolved = true;
        const validatedOriginalEventIds = new Set();
        events.forEach(event => {
          if (event.kind === 30398) {
            getReferencedEventIds(event).forEach(eventId => {
              validatedOriginalEventIds.add(eventId);
            });
          }
        });
        const dedupedEvents = [
          ...new Map(
            events
              .filter(
                event =>
                  !(
                    event.kind === 30397 &&
                    validatedOriginalEventIds.has(event.id)
                  ),
              )
              .map(event => [event.id, event]),
          ).values(),
        ]
          .sort((a, b) => b.created_at - a.created_at)
          .slice(0, limit);
        resolve(dedupedEvents);
        queueMicrotask(() => subscriptionRef.current?.close());
      };

      subscriptionRef.current = relay.subscribe(
        [
          { kinds: [30397], authors: [pubkeyHex], limit },
          {
            kinds: [30398],
            authors: [NOSTROOTS_VALIDATION_PUBKEY],
            '#p': [pubkeyHex],
            limit,
          },
        ],
        {
          onevent(event) {
            events.push(event);
          },
          oneose: finish,
          onclose: finish,
        },
      );
    });
  }

  /**
   * Resolve a pubkey to a Trustroots username via kind 10390 events.
   * Looks for a tag matching ['l', <username>, 'org.trustroots:username'].
   * Results are cached in this.usernameCache.
   *
   * @param {string} pubkeyHex — hex-encoded public key
   * @returns {Promise<string|null>} the username or null
   */
  async resolveNpubToUsername(pubkeyHex) {
    if (this.usernameCache.has(pubkeyHex)) {
      return this.usernameCache.get(pubkeyHex);
    }

    const relay = await this.connect();

    return new Promise(resolve => {
      const subscriptionRef = { current: null };
      let username = null;
      let resolved = false;

      const finish = () => {
        if (resolved) {
          return;
        }
        resolved = true;
        this.usernameCache.set(pubkeyHex, username);
        resolve(username);
        queueMicrotask(() => subscriptionRef.current?.close());
      };

      subscriptionRef.current = relay.subscribe(
        [
          {
            kinds: [10390],
            authors: [pubkeyHex],
          },
        ],
        {
          onevent(event) {
            const tag = event.tags.find(
              t =>
                t[0] === 'l' &&
                t.length >= 3 &&
                t[2] === 'org.trustroots:username',
            );
            if (tag) {
              username = tag[1];
            }
          },
          oneose: finish,
          onclose: finish,
        },
      );
    });
  }
}

export const nostrService = new NostrService(NOSTR_RELAY_URL);
