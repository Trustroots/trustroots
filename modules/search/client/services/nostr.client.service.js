import { Relay } from 'nostr-tools/relay';

/**
 * NostrService — manages WebSocket relay connection and Nostr subscriptions.
 * Framework-agnostic; consumed by React components in later tasks.
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
    if (this.relay) {
      return this.relay;
    }
    // eslint-disable-next-line no-console
    console.log('[Nostr] Connecting to', this.relayUrl);
    const relay = new Relay(this.relayUrl);
    await relay.connect();
    // eslint-disable-next-line no-console
    console.log('[Nostr] Connected');
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
   * Subscribe to map notes (kinds 30397, 30398) filtered by plus-code prefixes.
   * Closes any existing 'mapNotes' subscription before creating a new one.
   *
   * @param {string[]} plusCodePrefixes — open-location-code prefixes to filter by
   * @param {Function} onEvent — callback invoked for each matching event
   * @returns {Promise<object>} the subscription handle
   */
  async subscribeMapNotes(plusCodePrefixes, onEvent) {
    const relay = await this.connect();

    // Close previous mapNotes subscription if any
    const existing = this.subscriptions.get('mapNotes');
    if (existing) {
      existing.close();
    }

    // eslint-disable-next-line no-console
    console.log(
      '[Nostr] Subscribing to map notes, prefixes:',
      plusCodePrefixes,
    );

    let eventCount = 0;
    const sub = relay.subscribe(
      [
        {
          kinds: [30397, 30398],
          '#L': ['open-location-code-prefix'],
          '#l': plusCodePrefixes,
        },
      ],
      {
        onevent: event => {
          eventCount++;
          // eslint-disable-next-line no-console
          console.log(
            '[Nostr] Map note received (#%d): kind=%d, content=%s',
            eventCount,
            event.kind,
            event.content?.substring(0, 80),
          );
          onEvent(event);
        },
        oneose: () => {
          // eslint-disable-next-line no-console
          console.log(
            '[Nostr] Map notes subscription EOSE — %d events received',
            eventCount,
          );
        },
      },
    );

    this.subscriptions.set('mapNotes', sub);
    return sub;
  }

  /**
   * One-shot query for kind 30397 events by a given author.
   * Resolves with events sorted by created_at descending when EOSE is received.
   *
   * @param {string} pubkeyHex — hex-encoded public key
   * @param {number} [limit=3] — maximum number of events to fetch
   * @returns {Promise<object[]>} events sorted by created_at desc
   */
  async fetchUserNotes(pubkeyHex, limit = 3) {
    // eslint-disable-next-line no-console
    console.log('[Nostr] Fetching user notes for', pubkeyHex);
    const relay = await this.connect();
    const events = [];

    return new Promise(resolve => {
      relay.subscribe(
        [
          {
            kinds: [30397],
            authors: [pubkeyHex],
            limit,
          },
        ],
        {
          onevent(event) {
            events.push(event);
          },
          oneose() {
            // eslint-disable-next-line no-console
            console.log('[Nostr] User notes EOSE — %d events', events.length);
            events.sort((a, b) => b.created_at - a.created_at);
            resolve(events);
          },
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
      let username = null;

      relay.subscribe(
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
          oneose: () => {
            this.usernameCache.set(pubkeyHex, username);
            resolve(username);
          },
        },
      );
    });
  }
}
