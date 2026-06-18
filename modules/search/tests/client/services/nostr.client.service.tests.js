import NostrService, {
  getNostrEventAuthorPubkey,
} from '@/modules/search/client/services/nostr.client.service';

// Mock nostr-tools/relay
jest.mock('nostr-tools/relay', () => {
  const MockRelay = jest.fn().mockImplementation(url => {
    const instance = {
      url,
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
      subscribe: jest.fn(),
    };
    // Store last created instance for test access
    MockRelay._lastInstance = instance;
    return instance;
  });
  return { Relay: MockRelay };
});

const { Relay } = require('nostr-tools/relay');

describe('NostrService', () => {
  let service;
  const RELAY_URL = 'wss://relay.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NostrService(RELAY_URL);
  });

  describe('getNostrEventAuthorPubkey()', () => {
    it('returns the original author from kind 30398 reposts', () => {
      expect(
        getNostrEventAuthorPubkey({
          kind: 30398,
          pubkey: 'validation-server-pubkey',
          tags: [['p', 'original-author-pubkey']],
        }),
      ).toBe('original-author-pubkey');
    });

    it('falls back to event pubkey for direct events', () => {
      expect(
        getNostrEventAuthorPubkey({
          kind: 30397,
          pubkey: 'direct-author-pubkey',
          tags: [],
        }),
      ).toBe('direct-author-pubkey');
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
      const relay1 = await service.connect();
      const relay2 = await service.connect();
      expect(relay1).toBe(relay2);
      expect(Relay).toHaveBeenCalledTimes(1);
    });

    it('creates a new relay if the previous relay has closed', async () => {
      const relay1 = await service.connect();
      relay1.connected = false;

      const relay2 = await service.connect();

      expect(relay2).not.toBe(relay1);
      expect(Relay).toHaveBeenCalledTimes(2);
    });
  });

  describe('unsubscribeMapNotes()', () => {
    it('closes only the mapNotes subscription', async () => {
      const mapSub = { close: jest.fn() };
      const otherSub = { close: jest.fn() };
      service.subscriptions.set('mapNotes', mapSub);
      service.subscriptions.set('other', otherSub);

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
      service.subscriptions.set('mapNotes', mockSub);

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
      service.subscriptions.set('a', sub1);
      service.subscriptions.set('b', sub2);

      service.disconnect();

      expect(sub1.close).toHaveBeenCalled();
      expect(sub2.close).toHaveBeenCalled();
    });
  });

  describe('subscribeMapNotes()', () => {
    it('subscribes with correct filters for verified notes', async () => {
      const mockSub = { close: jest.fn() };
      await service.connect();
      Relay._lastInstance.subscribe.mockReturnValue(mockSub);

      const onEvent = jest.fn();

      const sub = await service.subscribeMapNotes(onEvent);

      expect(Relay._lastInstance.subscribe).toHaveBeenCalledWith(
        [
          {
            kinds: [30398],
            authors: [
              'f5bc71692fc08ea52c0d1c8bcfb87579584106b5feb4ea542b1b8a95612f257b',
            ],
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

    it('allows callers to override the historical map note limit', async () => {
      const mockSub = { close: jest.fn() };
      await service.connect();
      Relay._lastInstance.subscribe.mockReturnValue(mockSub);

      await service.subscribeMapNotes(jest.fn(), 25);

      expect(Relay._lastInstance.subscribe).toHaveBeenCalledWith(
        [
          {
            kinds: [30398],
            authors: [
              'f5bc71692fc08ea52c0d1c8bcfb87579584106b5feb4ea542b1b8a95612f257b',
            ],
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

      Relay._lastInstance.subscribe.mockReturnValueOnce(oldSub);
      await service.subscribeMapNotes(jest.fn());

      Relay._lastInstance.subscribe.mockReturnValueOnce(newSub);
      await service.subscribeMapNotes(jest.fn());

      expect(oldSub.close).toHaveBeenCalled();
      expect(service.subscriptions.get('mapNotes')).toBe(newSub);
    });

    it('connects lazily if not already connected', async () => {
      const mockSub = { close: jest.fn() };
      // Service starts disconnected — subscribe should trigger connect
      Relay.mockImplementationOnce(url => {
        const instance = {
          url,
          connect: jest.fn().mockResolvedValue(undefined),
          close: jest.fn(),
          subscribe: jest.fn().mockReturnValue(mockSub),
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
      const relay = Relay._lastInstance;

      const events = [
        { id: '1', created_at: 100 },
        { id: '2', created_at: 300 },
        { id: '3', created_at: 200 },
      ];

      let sub;
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
        [
          { kinds: [30397], authors: ['aabbcc'], limit: 3 },
          {
            kinds: [30398],
            authors: [
              'f5bc71692fc08ea52c0d1c8bcfb87579584106b5feb4ea542b1b8a95612f257b',
            ],
            '#p': ['aabbcc'],
            limit: 3,
          },
        ],
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
      const relay = Relay._lastInstance;

      relay.subscribe.mockImplementation((filters, callbacks) => {
        callbacks.oneose();
        return { close: jest.fn() };
      });

      await service.fetchUserNotes('aabbcc');

      expect(relay.subscribe).toHaveBeenCalledWith(
        [
          { kinds: [30397], authors: ['aabbcc'], limit: 3 },
          {
            kinds: [30398],
            authors: [
              'f5bc71692fc08ea52c0d1c8bcfb87579584106b5feb4ea542b1b8a95612f257b',
            ],
            '#p': ['aabbcc'],
            limit: 3,
          },
        ],
        expect.any(Object),
      );
    });

    it('resolves with empty array when no events', async () => {
      await service.connect();
      Relay._lastInstance.subscribe.mockImplementation((filters, callbacks) => {
        callbacks.oneose();
        return { close: jest.fn() };
      });

      const result = await service.fetchUserNotes('aabbcc');
      expect(result).toEqual([]);
    });

    it('resolves with collected events when the subscription closes early', async () => {
      await service.connect();
      Relay._lastInstance.subscribe.mockImplementation((filters, callbacks) => {
        callbacks.onevent({ id: '1', created_at: 100 });
        callbacks.onclose('relay closed');
        return { close: jest.fn() };
      });

      const result = await service.fetchUserNotes('aabbcc');

      expect(result).toEqual([{ id: '1', created_at: 100 }]);
    });
  });

  describe('resolveNpubToUsername()', () => {
    it('resolves username from kind 10390 event tags', async () => {
      await service.connect();
      const relay = Relay._lastInstance;

      let sub;
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
      Relay._lastInstance.subscribe.mockImplementation((filters, callbacks) => {
        callbacks.onevent({
          tags: [['L', 'org.trustroots']],
        });
        callbacks.oneose();
        return { close: jest.fn() };
      });

      const username = await service.resolveNpubToUsername('pubkey123');
      expect(username).toBeNull();
    });

    it('returns null when no events received', async () => {
      await service.connect();
      Relay._lastInstance.subscribe.mockImplementation((filters, callbacks) => {
        callbacks.oneose();
        return { close: jest.fn() };
      });

      const username = await service.resolveNpubToUsername('pubkey123');
      expect(username).toBeNull();
    });

    it('caches results and returns cached value on subsequent calls', async () => {
      await service.connect();
      const relay = Relay._lastInstance;

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
      const relay = Relay._lastInstance;

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
      Relay._lastInstance.subscribe.mockImplementation((filters, callbacks) => {
        callbacks.onclose('relay closed');
        return { close: jest.fn() };
      });

      await expect(
        service.resolveNpubToUsername('pubkey123'),
      ).resolves.toBeNull();
    });
  });
});
