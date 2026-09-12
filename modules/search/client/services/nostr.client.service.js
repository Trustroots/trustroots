/* eslint-disable angular/log, angular/window-service */

// nostr-tools v2 exposes subpaths via the package.json `exports` map, which
// webpack 4 can't resolve, so import the CJS build file directly.
import { Relay } from 'nostr-tools/lib/cjs/relay.js';

export const NOSTR_RELAY_URL = 'wss://relay.trustroots.org';
export const MAP_NOTES_LIMIT = 500;
export const NOSTR_AUTHOR_VISIBILITY_ENDPOINT = '/api/nostr/author-visibility';
export const AUTHOR_VISIBILITY_CACHE_TTL_MS = 5 * 60 * 1000;

export function getNostrEventAuthorPubkey(event) {
  return event?.pubkey;
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
    this.communityNoteAuthorVisibilityCache = new Map();
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
   * Subscribe to recent original map notes (kind 30397). Author visibility is
   * evaluated separately against current Trustroots account state.
   * Closes any existing 'mapNotes' subscription before creating a new one.
   *
   * @param {Function} onEvent — callback invoked for each matching event
   * @param {number} [limit=MAP_NOTES_LIMIT] — maximum historical events
   * @param {object} [callbacks] — subscription lifecycle callbacks
   * @returns {Promise<object>} the subscription handle
   */
  async subscribeMapNotes(
    onEvent,
    limit = MAP_NOTES_LIMIT,
    { onClose, onEose } = {},
  ) {
    const relay = await this.connect();

    this.unsubscribeMapNotes();

    const sub = relay.subscribe(
      [
        {
          kinds: [30397],
          limit,
        },
      ],
      {
        onevent: onEvent,
        oneose: onEose || (() => {}),
        onclose: onClose,
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
        const dedupedEvents = [
          ...new Map(events.map(event => [event.id, event])).values(),
        ]
          .sort((a, b) => b.created_at - a.created_at)
          .slice(0, limit);
        resolve(dedupedEvents);
        queueMicrotask(() => subscriptionRef.current?.close());
      };

      subscriptionRef.current = relay.subscribe(
        [{ kinds: [30397], authors: [pubkeyHex], limit }],
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

  async filterCommunityNotesByAuthorVisibility(notes) {
    const now = Date.now();
    const authorPubkeys = [
      ...new Set(
        notes
          .map(note => (note.authorPubkey || note.pubkey || '').toLowerCase())
          .filter(pubkey => /^[0-9a-f]{64}$/.test(pubkey)),
      ),
    ];
    const unresolvedPubkeys = authorPubkeys.filter(pubkey => {
      const cached = this.communityNoteAuthorVisibilityCache.get(pubkey);
      return !cached || cached.expiresAt <= now;
    });

    try {
      for (let index = 0; index < unresolvedPubkeys.length; index += 100) {
        const query = new URLSearchParams();
        const batch = unresolvedPubkeys.slice(index, index + 100);
        batch.forEach(pubkey => query.append('pubkey', pubkey));

        const response = await fetch(
          `${NOSTR_AUTHOR_VISIBILITY_ENDPOINT}?${query.toString()}`,
        );
        if (!response.ok) throw new Error('Author visibility lookup failed');

        const payload = await response.json();
        if (
          !angular.isArray(payload?.pubkeys) ||
          !angular.isArray(payload?.linkedPubkeys)
        ) {
          throw new Error('Invalid author visibility response');
        }

        const linkedPubkeys = new Set(
          payload.linkedPubkeys
            .filter(pubkey => angular.isString(pubkey))
            .map(pubkey => pubkey.toLowerCase()),
        );
        const visiblePubkeys = new Set(
          payload.pubkeys
            .filter(pubkey => angular.isString(pubkey))
            .map(pubkey => pubkey.toLowerCase()),
        );
        const expiresAt = Date.now() + AUTHOR_VISIBILITY_CACHE_TTL_MS;
        batch.forEach(pubkey => {
          this.communityNoteAuthorVisibilityCache.set(pubkey, {
            visible: !linkedPubkeys.has(pubkey) || visiblePubkeys.has(pubkey),
            expiresAt,
          });
        });
      }
    } catch {
      // Visibility failures are not cached. The next map update can retry.
    }

    return notes.filter(note => {
      const authorPubkey = (
        note.authorPubkey ||
        note.pubkey ||
        ''
      ).toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(authorPubkey)) return false;
      const cached = this.communityNoteAuthorVisibilityCache.get(authorPubkey);
      return cached ? cached.visible : true;
    });
  }
}

export const nostrService = new NostrService(NOSTR_RELAY_URL);
