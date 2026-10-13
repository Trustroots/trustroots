import NostrService, {
  getNostrEventAuthorPubkey,
} from '@/modules/search/client/services/nostr.client.service';
import type { Event } from 'nostr-tools';

interface MockRelaySubscription {
  close: jest.Mock;
}
type ServiceSubscription = NostrService['subscriptions'] extends Map<
  string,
  infer Subscription
>
  ? Subscription
  : never;

type MockNostrEvent = Omit<Partial<Event>, 'tags'> & {
  tags?: Array<Array<string | undefined>>;
};
interface MockSubscriptionCallbacks {
  onevent: (event: MockNostrEvent) => void;
  oneose: () => void;
  onclose: (reason: string) => void;
}

interface MockRelayInstance {
  url: string;
  connected?: boolean;
  onclose: () => void;
  connect: jest.Mock<Promise<void>, []>;
  close: jest.Mock<void, []>;
  subscribe: jest.Mock<
    MockRelaySubscription,
    [filters: unknown, callbacks: MockSubscriptionCallbacks]
  >;
}

interface MockRelayConstructor extends jest.Mock {
  _lastInstance?: MockRelayInstance;
}

let mockFetch: jest.Mock<Promise<Response>, Parameters<typeof fetch>>;

// Mock nostr-tools/relay
jest.mock('nostr-tools/relay', () => {
  const MockRelay = jest.fn((url: string): MockRelayInstance => {
    const instance = {
      url,
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
      subscribe: jest.fn().mockImplementation(() => ({ close: jest.fn() })),
      onclose: jest.fn(),
    };
    // Store last created instance for test access
    (MockRelay as MockRelayConstructor)._lastInstance = instance;
    return instance;
  }) as MockRelayConstructor;
  return { Relay: MockRelay };
});

const { Relay } = jest.requireMock('nostr-tools/relay') as {
  Relay: MockRelayConstructor;
};

function lastRelay(): MockRelayInstance {
  if (!Relay._lastInstance) {
    throw new Error('Expected a relay instance to have been created');
  }
  return Relay._lastInstance;
}

function asServiceSubscription(
  subscription: MockRelaySubscription,
): ServiceSubscription {
  // Relay subscription doubles expose only the close method exercised here.
  // Install a deliberately minimal external subscription double.
  const subscriptions = new Map<string, ServiceSubscription>();
  Reflect.apply(subscriptions.set, subscriptions, ['fixture', subscription]);
  return subscriptions.get('fixture')!;
}

function mockVisibilityResponse(payload: unknown, ok = true): Response {
  // The tests need only the fetch fields consumed by this service.
  return { ok, json: async () => payload } as Response;
}

describe('NostrService', () => {
  let service: NostrService;
  const RELAY_URL = 'wss://relay.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NostrService(RELAY_URL);
  });

  describe('getNostrEventAuthorPubkey()', () => {
    it('returns the event author', () => {
      const event: Pick<Event, 'pubkey'> & Partial<Event> = {
        kind: 30397,
        pubkey: 'direct-author-pubkey',
        tags: [],
      };
      expect(getNostrEventAuthorPubkey(event)).toBe('direct-author-pubkey');
    });

    it('returns undefined when event data is missing', () => {
      expect(getNostrEventAuthorPubkey(null)).toBeUndefined();
    });
  });

  describe('hackerspace place subscriptions', () => {
    it('opens independent publication connections to both fixed relays', async () => {
      const shared = await service.connect();
      const connections = await service.connectHackerPlaceRelays();
      expect(connections.map(connection => connection.url)).toEqual([
        'wss://relay.trustroots.org',
        'wss://relay.nomadwiki.org',
      ]);
      expect(Relay).toHaveBeenCalledTimes(3);
      expect(connections.every(connection => connection.relay !== null)).toBe(
        true,
      );
      expect(service.relay).toBe(shared);
      expect(connections.every(connection => connection.relay !== shared)).toBe(
        true,
      );
      for (const connection of connections) connection.relay?.close();
    });

    it('closes a failed connection and keeps the other available', async () => {
      const close = jest.fn();
      Relay.mockImplementationOnce((url: string) => ({
        url,
        connect: jest.fn().mockRejectedValue(new Error('offline')),
        close,
        subscribe: jest.fn(),
        onclose: jest.fn(),
      }));
      const connections = await service.connectHackerPlaceRelays();
      expect(connections[0]).toEqual({
        url: 'wss://relay.trustroots.org',
        relay: null,
      });
      expect(connections[1].relay).not.toBeNull();
      expect(close).toHaveBeenCalledTimes(1);
      connections[1].relay?.close();
    });

    const placeRelays = () =>
      Relay.mock.results
        .slice(-2)
        .map(result => result.value as MockRelayInstance);
    const place = (
      id: string,
      created_at = 1,
      pubkey = 'author',
      tags = [['d', 'example-place']],
    ) => ({ id, created_at, pubkey, tags, content: id });

    it('merges both relays, ignores duplicates and old versions, and preserves separate authors', async () => {
      const onEvent = jest.fn();
      const onEose = jest.fn();
      const onClose = jest.fn();
      const notes = { close: jest.fn() };
      service.subscriptions.set('mapNotes', asServiceSubscription(notes));
      const group = await service.subscribeHackerPlaces(onEvent, {
        onEose,
        onClose,
      });
      const [trustroots, nomadwiki] = placeRelays();
      for (const relay of [trustroots, nomadwiki])
        expect(relay.subscribe).toHaveBeenCalledWith(
          [{ kinds: [33000], '#L': ['physical-location'], limit: 1000 }],
          expect.any(Object),
        );
      const a = trustroots.subscribe.mock.calls[0][1];
      const b = nomadwiki.subscribe.mock.calls[0][1];
      a.onevent(place('first'));
      b.onevent(place('first'));
      b.onevent(place('newest', 3));
      a.onevent(place('older', 2));
      a.onevent(place('zzzz', 3));
      b.onevent(place('aaaa', 3));
      b.onevent(place('other-author', 1, 'other-author'));
      b.onevent(place('no-identifier', 1, 'author', []));
      expect(onEvent.mock.calls.map(call => call[0].id)).toEqual([
        'first',
        'newest',
        'aaaa',
        'other-author',
        'no-identifier',
      ]);
      a.oneose();
      expect(onEose).not.toHaveBeenCalled();
      b.oneose();
      b.oneose();
      expect(onEose).toHaveBeenCalledTimes(1);
      a.onclose('first offline');
      expect(onClose).not.toHaveBeenCalled();
      b.onclose('both offline');
      expect(onClose).toHaveBeenCalledWith('both offline');
      group.close();
      group.close();
      a.onevent(place('after-close', 5));
      a.oneose();
      a.onclose('after close');
      expect(onEvent).toHaveBeenCalledTimes(5);
      service.unsubscribeHackerPlaces();
      expect(notes.close).not.toHaveBeenCalled();
      for (const relay of [trustroots, nomadwiki])
        expect(relay.close).toHaveBeenCalledTimes(1);
    });

    it('keeps Nomadwiki discovery available when Trustroots cannot connect', async () => {
      Relay.mockImplementationOnce((url: string) => ({
        url,
        connect: jest.fn().mockRejectedValue(new Error('offline')),
        close: jest.fn(),
      }));
      const onEose = jest.fn();
      const onClose = jest.fn();
      await service.subscribeHackerPlaces(jest.fn(), { onEose, onClose });
      const relay = lastRelay();
      const callbacks = relay.subscribe.mock.calls[0][1];
      callbacks.oneose();
      expect(onEose).toHaveBeenCalledTimes(1);
      callbacks.onclose('offline');
      expect(onClose).toHaveBeenCalledWith('offline');
      service.unsubscribeHackerPlaces();
    });

    it('finishes loading when the other relay closes before its end-of-stored-events', async () => {
      const onEose = jest.fn();
      await service.subscribeHackerPlaces(jest.fn(), { onEose });
      const [a, b] = placeRelays().map(
        relay => relay.subscribe.mock.calls[0][1],
      );
      a.oneose();
      b.onclose('closed');
      expect(onEose).toHaveBeenCalledTimes(1);
      a.onclose('closed');
      service.unsubscribeHackerPlaces();
    });

    it('supports default callbacks, replaces only place subscriptions, and cleans up on disconnect', async () => {
      await service.subscribeHackerPlaces(jest.fn());
      const first = placeRelays();
      for (const relay of first) relay.subscribe.mock.calls[0][1].oneose();
      for (const relay of first)
        relay.subscribe.mock.calls[0][1].onclose('closed');
      await service.subscribeHackerPlaces(jest.fn());
      for (const relay of first) expect(relay.close).toHaveBeenCalledTimes(1);
      const next = placeRelays();
      service.disconnect();
      for (const relay of next) expect(relay.close).toHaveBeenCalledTimes(1);
    });

    it('cleans up connections that finish opening after unsubscribe', async () => {
      const opening = service.subscribeHackerPlaces(jest.fn());
      service.unsubscribeHackerPlaces();
      await opening;
      for (const relay of placeRelays())
        expect(relay.close).toHaveBeenCalledTimes(1);
    });

    it('reports complete connection failure for both discovery consumers', async () => {
      jest.spyOn(service, 'connectHackerPlaceRelays').mockResolvedValue([
        { url: 'trustroots', relay: null },
        { url: 'nomadwiki', relay: null },
      ]);
      await expect(service.subscribeHackerPlaces(jest.fn())).rejects.toThrow(
        'No place discovery relays',
      );
      await expect(service.fetchHackerPlaceEvents()).rejects.toThrow(
        'No place discovery relays',
      );
    });

    it.each(['eose', 'close'])(
      'collects newest preview events from both relays until %s',
      async completion => {
        const result = service.fetchHackerPlaceEvents();
        for (let count = 0; count < 8; count++) await Promise.resolve();
        const [a, b] = placeRelays().map(
          relay => relay.subscribe.mock.calls[0][1],
        );
        a.onevent(place('old'));
        b.onevent(place('latest', 2));
        b.onevent(place('unaddressed', 1, 'author', []));
        if (completion === 'eose') {
          a.oneose();
          b.oneose();
        } else {
          a.onclose('closed');
          b.onclose('closed');
        }
        expect(await result).toEqual([
          place('latest', 2),
          place('unaddressed', 1, 'author', []),
        ]);
        for (const relay of placeRelays()) {
          expect(relay.close).toHaveBeenCalledTimes(1);
          expect(
            relay.subscribe.mock.results[0].value.close,
          ).toHaveBeenCalledTimes(1);
        }
      },
    );

    it('cleans up if relays synchronously end a preview subscription', async () => {
      for (let index = 0; index < 2; index++)
        Relay.mockImplementationOnce((url: string) => ({
          url,
          connect: jest.fn().mockResolvedValue(undefined),
          close: jest.fn(),
          subscribe: jest.fn((_filters, callbacks) => {
            callbacks.oneose();
            return { close: jest.fn() };
          }),
        }));
      expect(await service.fetchHackerPlaceEvents()).toEqual([]);
      for (let count = 0; count < 4; count++) await Promise.resolve();
      for (const relay of placeRelays())
        expect(relay.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('constructor', () => {
    it('stores the relay URL', () => {
      expect(service.relayUrl).toBe(RELAY_URL);
    });

    it('initializes with null relay', () => {
      expect(service.relay).toBeNull();
    });

    it('initializes empty subscriptions map', () => {
      expect(service.subscriptions).toBeInstanceOf(Map);
      expect(service.subscriptions.size).toBe(0);
    });

    it('initializes empty username cache', () => {
      expect(service.usernameCache).toBeInstanceOf(Map);
      expect(service.usernameCache.size).toBe(0);
    });
  });

  describe('connect()', () => {
    it('creates a new Relay and connects', async () => {
      const relay = await service.connect();
      expect(Relay).toHaveBeenCalledWith(RELAY_URL);
      expect(relay.connect).toHaveBeenCalled();
      expect(service.relay).toBe(relay);
    });

    it('returns existing relay if already connected', async () => {
      const relay1 = (await service.connect(), lastRelay());
      const relay2 = await service.connect();
      expect(relay1).toBe(relay2);
      expect(Relay).toHaveBeenCalledTimes(1);
    });

    it('creates a new relay if the previous relay has closed', async () => {
      const relay1 = (await service.connect(), lastRelay());
      relay1.connected = false;

      const relay2 = await service.connect();

      expect(relay2).not.toBe(relay1);
      expect(Relay).toHaveBeenCalledTimes(2);
    });

    it('clears the relay and subscriptions when the active relay closes', async () => {
      const relay = (await service.connect(), lastRelay());
      service.subscriptions.set(
        'mapNotes',
        asServiceSubscription({ close: jest.fn() }),
      );

      relay.onclose();

      expect(service.relay).toBeNull();
      expect(service.subscriptions.size).toBe(0);
    });

    it('leaves a newer relay in place when an older relay closes', async () => {
      const relay1 = (await service.connect(), lastRelay());
      relay1.connected = false;
      const relay2 = await service.connect();
      service.subscriptions.set(
        'mapNotes',
        asServiceSubscription({ close: jest.fn() }),
      );

      relay1.onclose();

      expect(service.relay).toBe(relay2);
      expect(service.subscriptions.size).toBe(0);
    });
  });

  describe('unsubscribeMapNotes()', () => {
    it('closes only the mapNotes subscription', async () => {
      const mapSub = { close: jest.fn() };
      const otherSub = { close: jest.fn() };
      service.subscriptions.set('mapNotes', asServiceSubscription(mapSub));
      service.subscriptions.set('other', asServiceSubscription(otherSub));

      service.unsubscribeMapNotes();

      expect(mapSub.close).toHaveBeenCalled();
      expect(otherSub.close).not.toHaveBeenCalled();
      expect(service.subscriptions.has('mapNotes')).toBe(false);
      expect(service.subscriptions.get('other')).toBe(otherSub);
    });

    it('handles missing mapNotes subscription', () => {
      expect(() => service.unsubscribeMapNotes()).not.toThrow();
    });
  });

  describe('disconnect()', () => {
    it('closes all subscriptions and the relay', async () => {
      await service.connect();
      const mockSub = { close: jest.fn() };
      service.subscriptions.set('mapNotes', asServiceSubscription(mockSub));

      service.disconnect();

      expect(mockSub.close).toHaveBeenCalled();
      expect(service.subscriptions.size).toBe(0);
      expect(service.relay).toBeNull();
    });

    it('handles disconnect when not connected', () => {
      expect(() => service.disconnect()).not.toThrow();
    });

    it('closes multiple subscriptions', async () => {
      await service.connect();
      const sub1 = { close: jest.fn() };
      const sub2 = { close: jest.fn() };
      service.subscriptions.set('a', asServiceSubscription(sub1));
      service.subscriptions.set('b', asServiceSubscription(sub2));

      service.disconnect();

      expect(sub1.close).toHaveBeenCalled();
      expect(sub2.close).toHaveBeenCalled();
    });
  });

  describe('subscribeMapNotes()', () => {
    it('subscribes with correct filters for original notes', async () => {
      const mockSub = { close: jest.fn() };
      await service.connect();
      lastRelay().subscribe.mockReturnValue(mockSub);

      const onEvent = jest.fn();

      const sub = await service.subscribeMapNotes(onEvent);

      expect(lastRelay().subscribe).toHaveBeenCalledWith(
        [
          {
            kinds: [30397],
            limit: 500,
          },
        ],
        expect.objectContaining({
          onevent: expect.any(Function),
          oneose: expect.any(Function),
        }),
      );
      expect(sub).toBe(mockSub);
      expect(service.subscriptions.get('mapNotes')).toBe(mockSub);
    });

    it('accepts the relay end-of-stored-events callback for map notes', async () => {
      const mockSub = { close: jest.fn() };
      await service.connect();
      lastRelay().subscribe.mockImplementation((filters, callbacks) => {
        callbacks.oneose();
        return mockSub;
      });

      await expect(service.subscribeMapNotes(jest.fn())).resolves.toBe(mockSub);
    });

    it('forwards map subscription lifecycle callbacks', async () => {
      const mockSub = { close: jest.fn() };
      const onClose = jest.fn();
      const onEose = jest.fn();
      await service.connect();
      lastRelay().subscribe.mockImplementation((filters, callbacks) => {
        callbacks.oneose();
        callbacks.onclose('relay connection closed');
        return mockSub;
      });

      await service.subscribeMapNotes(jest.fn(), 25, { onClose, onEose });

      expect(onEose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith('relay connection closed');
    });

    it('allows callers to override the historical map note limit', async () => {
      const mockSub = { close: jest.fn() };
      await service.connect();
      lastRelay().subscribe.mockReturnValue(mockSub);

      await service.subscribeMapNotes(jest.fn(), 25);

      expect(lastRelay().subscribe).toHaveBeenCalledWith(
        [
          {
            kinds: [30397],
            limit: 25,
          },
        ],
        expect.any(Object),
      );
    });

    it('closes existing mapNotes subscription before creating new one', async () => {
      const oldSub = { close: jest.fn() };
      const newSub = { close: jest.fn() };
      await service.connect();

      lastRelay().subscribe.mockReturnValueOnce(oldSub);
      await service.subscribeMapNotes(jest.fn());

      lastRelay().subscribe.mockReturnValueOnce(newSub);
      await service.subscribeMapNotes(jest.fn());

      expect(oldSub.close).toHaveBeenCalled();
      expect(service.subscriptions.get('mapNotes')).toBe(newSub);
    });

    it('connects lazily if not already connected', async () => {
      const mockSub = { close: jest.fn() };
      // Service starts disconnected — subscribe should trigger connect
      Relay.mockImplementationOnce((url: string): MockRelayInstance => {
        const instance = {
          url,
          connect: jest.fn().mockResolvedValue(undefined),
          close: jest.fn(),
          subscribe: jest.fn().mockReturnValue(mockSub),
          onclose: jest.fn(),
        };
        Relay._lastInstance = instance;
        return instance;
      });

      const sub = await service.subscribeMapNotes(jest.fn());
      expect(Relay).toHaveBeenCalledWith(RELAY_URL);
      expect(sub).toBe(mockSub);
    });
  });

  describe('fetchUserNotes()', () => {
    it('resolves with events sorted by created_at desc', async () => {
      await service.connect();
      const relay = lastRelay();

      const events = [
        { id: '1', created_at: 100 },
        { id: '2', created_at: 300 },
        { id: '3', created_at: 200 },
      ];

      let sub!: MockRelaySubscription;
      relay.subscribe.mockImplementation((filters, callbacks) => {
        sub = { close: jest.fn() };
        events.forEach(e => callbacks.onevent(e));
        callbacks.oneose();
        return sub;
      });

      const result = await service.fetchUserNotes('aabbcc', 3);
      await Promise.resolve();

      expect(sub.close).toHaveBeenCalled();

      expect(relay.subscribe).toHaveBeenCalledWith(
        [{ kinds: [30397], authors: ['aabbcc'], limit: 3 }],
        expect.objectContaining({
          onevent: expect.any(Function),
          oneose: expect.any(Function),
        }),
      );

      expect(result).toEqual([
        { id: '2', created_at: 300 },
        { id: '3', created_at: 200 },
        { id: '1', created_at: 100 },
      ]);
    });

    it('uses default limit of 3', async () => {
      await service.connect();
      const relay = lastRelay();

      relay.subscribe.mockImplementation((filters, callbacks) => {
        callbacks.oneose();
        return { close: jest.fn() };
      });

      await service.fetchUserNotes('aabbcc');

      expect(relay.subscribe).toHaveBeenCalledWith(
        [{ kinds: [30397], authors: ['aabbcc'], limit: 3 }],
        expect.any(Object),
      );
    });

    it('resolves with empty array when no events', async () => {
      await service.connect();
      lastRelay().subscribe.mockImplementation((filters, callbacks) => {
        callbacks.oneose();
        return { close: jest.fn() };
      });

      const result = await service.fetchUserNotes('aabbcc');
      expect(result).toEqual([]);
    });

    it('resolves with collected events when the subscription closes early', async () => {
      await service.connect();
      lastRelay().subscribe.mockImplementation((filters, callbacks) => {
        callbacks.onevent({ id: '1', created_at: 100 });
        callbacks.onclose('relay closed');
        return { close: jest.fn() };
      });

      const result = await service.fetchUserNotes('aabbcc');

      expect(result).toEqual([{ id: '1', created_at: 100 }]);
    });

    it('deduplicates events, applies the limit, and ignores repeated finishes', async () => {
      await service.connect();
      const sub = { close: jest.fn() };
      lastRelay().subscribe.mockImplementation((filters, callbacks) => {
        callbacks.onevent({ id: '1', created_at: 100, content: 'old' });
        callbacks.onevent({ id: '1', created_at: 500, content: 'new' });
        callbacks.onevent({ id: '2', created_at: 300 });
        callbacks.oneose();
        callbacks.onclose('already resolved');
        return sub;
      });

      const result = await service.fetchUserNotes('aabbcc', 1);
      await Promise.resolve();

      expect(result).toEqual([{ id: '1', created_at: 500, content: 'new' }]);
      expect(sub.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolveNpubToUsername()', () => {
    it('returns a cached null without reconnecting', async () => {
      service.usernameCache.set('cached-empty-key', null);

      await expect(
        service.resolveNpubToUsername('cached-empty-key'),
      ).resolves.toBeNull();
      expect(Relay._lastInstance?.subscribe).not.toHaveBeenCalled();
    });

    it('resolves username from kind 10390 event tags', async () => {
      await service.connect();
      const relay = lastRelay();

      let sub!: MockRelaySubscription;
      relay.subscribe.mockImplementation((filters, callbacks) => {
        sub = { close: jest.fn() };
        callbacks.onevent({
          tags: [
            ['l', 'alice', 'org.trustroots:username'],
            ['L', 'org.trustroots'],
          ],
        });
        callbacks.oneose();
        return sub;
      });

      const username = await service.resolveNpubToUsername('pubkey123');
      await Promise.resolve();
      expect(username).toBe('alice');
      expect(sub.close).toHaveBeenCalled();
    });

    it('returns null when no username tag found', async () => {
      await service.connect();
      lastRelay().subscribe.mockImplementation((filters, callbacks) => {
        callbacks.onevent({
          tags: [['L', 'org.trustroots']],
        });
        callbacks.oneose();
        return { close: jest.fn() };
      });

      const username = await service.resolveNpubToUsername('pubkey123');
      expect(username).toBeNull();
    });

    it('handles a username tag without a value', async () => {
      await service.connect();
      lastRelay().subscribe.mockImplementation((filters, callbacks) => {
        callbacks.onevent({
          tags: [['l', undefined, 'org.trustroots:username']],
        });
        callbacks.oneose();
        return { close: jest.fn() };
      });

      await expect(
        service.resolveNpubToUsername('pubkey-with-empty-username'),
      ).resolves.toBeNull();
    });

    it('returns null when no events received', async () => {
      await service.connect();
      lastRelay().subscribe.mockImplementation((filters, callbacks) => {
        callbacks.oneose();
        return { close: jest.fn() };
      });

      const username = await service.resolveNpubToUsername('pubkey123');
      expect(username).toBeNull();
    });

    it('caches results and returns cached value on subsequent calls', async () => {
      await service.connect();
      const relay = lastRelay();

      relay.subscribe.mockImplementation((filters, callbacks) => {
        callbacks.onevent({
          tags: [['l', 'bob', 'org.trustroots:username']],
        });
        callbacks.oneose();
        return { close: jest.fn() };
      });

      const first = await service.resolveNpubToUsername('pubkey456');
      const second = await service.resolveNpubToUsername('pubkey456');

      expect(first).toBe('bob');
      expect(second).toBe('bob');
      // subscribe should only be called once (cached on second call)
      expect(relay.subscribe).toHaveBeenCalledTimes(1);
    });

    it('subscribes with correct filters', async () => {
      await service.connect();
      const relay = lastRelay();

      relay.subscribe.mockImplementation((filters, callbacks) => {
        callbacks.oneose();
        return { close: jest.fn() };
      });

      await service.resolveNpubToUsername('abc123');

      expect(relay.subscribe).toHaveBeenCalledWith(
        [{ kinds: [10390], authors: ['abc123'] }],
        expect.objectContaining({
          onevent: expect.any(Function),
          oneose: expect.any(Function),
        }),
      );
    });

    it('resolves null when the username subscription closes early', async () => {
      await service.connect();
      lastRelay().subscribe.mockImplementation((filters, callbacks) => {
        callbacks.onclose('relay closed');
        return { close: jest.fn() };
      });

      await expect(
        service.resolveNpubToUsername('pubkey123'),
      ).resolves.toBeNull();
    });

    it('ignores repeated username subscription finishes', async () => {
      await service.connect();
      const sub = { close: jest.fn() };
      lastRelay().subscribe.mockImplementation((filters, callbacks) => {
        callbacks.onevent({
          tags: [['l', 'carol', 'org.trustroots:username']],
        });
        callbacks.oneose();
        callbacks.onclose('already resolved');
        return sub;
      });

      await expect(service.resolveNpubToUsername('pubkey789')).resolves.toBe(
        'carol',
      );
      await Promise.resolve();

      expect(sub.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('filterCommunityNotesByAuthorVisibility()', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      mockFetch = jest.fn();
      global.fetch = mockFetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('keeps eligible and unlinked authors but hides known ineligible authors', async () => {
      const visiblePubkey = 'aa'.repeat(32);
      const hiddenPubkey = 'bb'.repeat(32);
      const unlinkedPubkey = 'cc'.repeat(32);
      mockFetch.mockResolvedValue(
        mockVisibilityResponse({
          linkedPubkeys: [visiblePubkey, hiddenPubkey],
          pubkeys: [visiblePubkey],
        }),
      );

      await expect(
        service.filterCommunityNotesByAuthorVisibility([
          { id: 'visible', authorPubkey: visiblePubkey },
          { id: 'visible-by-pubkey', pubkey: visiblePubkey },
          { id: 'hidden', authorPubkey: hiddenPubkey },
          { id: 'unlinked', authorPubkey: unlinkedPubkey },
          { id: 'missing-author' },
        ]),
      ).resolves.toEqual([
        { id: 'visible', authorPubkey: visiblePubkey },
        { id: 'visible-by-pubkey', pubkey: visiblePubkey },
        { id: 'unlinked', authorPubkey: unlinkedPubkey },
      ]);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/nostr/author-visibility?pubkey=' +
          visiblePubkey +
          '&pubkey=' +
          hiddenPubkey +
          '&pubkey=' +
          unlinkedPubkey,
      );
    });

    it('retries visibility checks after a transient API failure', async () => {
      const pubkey = 'aa'.repeat(32);
      const notes = [{ id: 'note', authorPubkey: pubkey }];
      mockFetch.mockRejectedValueOnce(new Error('service unavailable'));
      await expect(
        service.filterCommunityNotesByAuthorVisibility(notes),
      ).resolves.toEqual(notes);
      mockFetch.mockResolvedValueOnce(
        mockVisibilityResponse({ linkedPubkeys: [pubkey], pubkeys: [] }),
      );

      await expect(
        service.filterCommunityNotesByAuthorVisibility(notes),
      ).resolves.toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('batches uncached authors and reuses fresh visibility results', async () => {
      const notes = Array.from({ length: 101 }, (_, index) => ({
        id: `note-${index}`,
        authorPubkey: index.toString(16).padStart(64, '0'),
      }));
      mockFetch.mockResolvedValue(
        mockVisibilityResponse({
          linkedPubkeys: notes.map(note => note.authorPubkey),
          pubkeys: [],
        }),
      );

      await expect(
        service.filterCommunityNotesByAuthorVisibility(notes),
      ).resolves.toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      await expect(
        service.filterCommunityNotesByAuthorVisibility([notes[0]]),
      ).resolves.toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('keeps notes visible when the API response is unsuccessful or invalid', async () => {
      const pubkey = 'cc'.repeat(32);
      const notes = [{ id: 'note', authorPubkey: pubkey }];
      mockFetch.mockResolvedValueOnce(mockVisibilityResponse(null, false));

      await expect(
        service.filterCommunityNotesByAuthorVisibility(notes),
      ).resolves.toEqual(notes);

      mockFetch.mockResolvedValueOnce(
        mockVisibilityResponse({ linkedPubkeys: [], pubkeys: null }),
      );
      await expect(
        service.filterCommunityNotesByAuthorVisibility(notes),
      ).resolves.toEqual(notes);
    });
  });
});
