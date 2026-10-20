import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
  type Event,
  type EventTemplate,
} from 'nostr-tools';
import http from '@/modules/core/client/api/http-client.js';
import { Relay } from 'nostr-tools/relay';
import {
  activeListeners,
  connectRadioSigner,
  EVENT_TTL,
  eventType,
  FAVOURITES_KEY,
  hasTag,
  LISTENER_TTL,
  mergeFavourites,
  RadioRoom,
  readFavourites,
  roomTemplate,
  saveFavourites,
  stationFromHash,
  stationGroups,
  stations,
  tag,
} from '@/modules/tribes/client/services/radio.client.service';

jest.mock('@/modules/core/client/api/http-client.js', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock('nostr-tools/relay', () => ({ Relay: jest.fn() }));
const secret = generateSecretKey();
const publicKey = getPublicKey(secret);
const station = stations[0];
const second = stations[1];
const now = Math.floor(Date.now() / 1000);
const signed = (template: EventTemplate) => finalizeEvent(template, secret);

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  delete window.nostr;
});

it('preserves the catalogue, station hashes and existing event formats', () => {
  expect(stationFromHash(`#${station.id}/extra`)).toEqual(station);
  expect(stationFromHash('#unknown')).toBeUndefined();
  expect(stations.find(item => item.id === 'groovesalad')?.url).toBe(
    'https://ice1.somafm.com/groovesalad-128-mp3',
  );
  expect(stations.find(item => item.id === 'paradise')?.url).toBe(
    'https://stream.radioparadise.com/aac-128',
  );
  expect(stationGroups.map(group => group.name)).toContain('SomaFM');
  expect(
    eventType(signed(roomTemplate('chat', station, 'Hello', true, now))),
  ).toBe('chat');
  expect(roomTemplate('chat', undefined, 'Hello', true, now).tags).toEqual([
    ['t', 'radiostr'],
    ['expiration', String(now + EVENT_TTL)],
  ]);
  const listening = signed(
    roomTemplate('listening', station, station.title, true, now),
  );
  expect(eventType(listening)).toBe('listening');
  expect(tag(listening, 'radiostr_station')).toBe(station.id);
  expect(hasTag(listening, 'client', 'radiostr')).toBe(true);
  expect(eventType({ ...listening, kind: 0 })).toBeNull();
  expect(eventType({ ...listening, tags: [] })).toBeNull();
  expect(tag(listening, 'absent')).toBeUndefined();
});

it('deduplicates listeners, chooses newest stations and expires shared activity', () => {
  const listening = signed(
    roomTemplate('listening', station, 'Station', true, now),
  );
  const newer = signed(
    roomTemplate('listening', second, 'New station', true, now + 1),
  );
  expect(activeListeners([listening, newer, listening], now + 1)).toEqual([
    newer,
  ]);
  expect(activeListeners([listening], now + LISTENER_TTL + 1)).toEqual([]);
  expect(
    activeListeners([{ ...listening, created_at: now + 61 }], now),
  ).toEqual([]);
  expect(
    activeListeners(
      [
        {
          ...listening,
          tags: [
            ['t', 'radiostr'],
            ['t', 'nowplaying'],
          ],
        },
      ],
      now,
    ),
  ).toEqual([]);
  expect(
    activeListeners([signed(roomTemplate('chat', station, 'chat'))]),
  ).toEqual([]);
  expect(
    activeListeners(
      [
        {
          ...listening,
          tags: [...listening.tags, ['expiration', String(now - 1)]].filter(
            entry => entry[0] !== 'expiration' || entry[1] === String(now - 1),
          ),
        },
      ],
      now,
    ),
  ).toEqual([]);
  const tie = { ...listening, id: '0' };
  expect(activeListeners([listening, tie], now)).toEqual([tie]);
  const other = {
    ...listening,
    pubkey: 'another',
    created_at: now - 1,
    tags: listening.tags.filter(entry => entry[0] !== 'expiration'),
  };
  expect(activeListeners([listening, other], now)).toEqual([listening, other]);
});

it('reconciles favourite history including remote unstar actions and local-only entries', () => {
  const star = signed(
    roomTemplate('favourite', station, '⭐ station', true, now),
  );
  const unstar = signed(
    roomTemplate('favourite', station, '☆ station', false, now + 1),
  );
  expect(
    mergeFavourites([station.id, second.id, 'unknown'], [unstar, star]),
  ).toEqual([second.id]);
  expect(mergeFavourites([], [star, star])).toEqual([station.id]);
  const legacy = {
    ...star,
    tags: star.tags.filter(entry => entry[0] !== 'radiostr_action'),
    content: '☆ station',
  };
  expect(mergeFavourites([], [legacy])).toEqual([]);
  expect(mergeFavourites([], [{ ...legacy, content: '⭐ station' }])).toEqual([
    station.id,
  ]);
  expect(mergeFavourites([], [{ ...star, tags: [] }])).toEqual([]);
  expect(
    mergeFavourites(
      [],
      [
        {
          ...star,
          tags: star.tags.filter(entry => entry[0] !== 'radiostr_station'),
        },
      ],
    ),
  ).toEqual([]);
  expect(
    mergeFavourites([], [star, { ...star, id: '0', content: 'second' }]),
  ).toEqual([station.id]);
});

it('handles corrupt, blocked and unavailable browser storage', () => {
  expect(readFavourites()).toEqual([]);
  saveFavourites([station.id]);
  expect(readFavourites()).toEqual([station.id]);
  localStorage.setItem(FAVOURITES_KEY, '{}');
  expect(readFavourites()).toEqual([]);
  localStorage.setItem(FAVOURITES_KEY, '{');
  expect(readFavourites()).toEqual([]);
  const fail = jest
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new Error('blocked');
    });
  expect(() => saveFavourites([], 'custom')).not.toThrow();
  fail.mockRestore();
});

function provider() {
  window.nostr = {
    getPublicKey: jest.fn(async () => publicKey),
    signEvent: jest.fn(async template => ({
      ...signed(template as unknown as EventTemplate),
    })),
  };
  jest
    .mocked(http.get)
    .mockResolvedValue({ data: { names: { 'fictional-member': publicKey } } });
  return window.nostr;
}
const user = {
  username: 'fictional-member',
  nostrNpub: nip19.npubEncode(publicKey),
};

it('does not allow the signer to mutate the requested tags', async () => {
  const extension = provider();
  const signer = await connectRadioSigner(user);
  extension.signEvent = async value => {
    const template = value as unknown as EventTemplate;
    template.tags.push(['extra', 'changed']);
    return { ...signed(template) };
  };
  const template = roomTemplate('chat', station, 'Hello');
  await expect(signer.sign(template)).rejects.toThrow('unexpected');
  expect(template.tags.some(entry => entry[0] === 'extra')).toBe(false);
});
it('requires a matching linked NIP-05 identity and verifies signed contents', async () => {
  await expect(connectRadioSigner(user)).rejects.toThrow('extension');
  provider();
  await expect(connectRadioSigner({ username: user.username })).rejects.toThrow(
    'profile settings',
  );
  jest.mocked(http.get).mockResolvedValueOnce({ data: { names: {} } });
  await expect(connectRadioSigner(user)).rejects.toThrow('must match');
  await expect(
    connectRadioSigner({ ...user, nostrNpub: nip19.noteEncode(publicKey) }),
  ).rejects.toThrow('must match');
  const extension = provider();
  const signer = await connectRadioSigner(user);
  const template = roomTemplate('chat', station, 'Hello');
  expect(await signer.sign(template)).toMatchObject({
    ...template,
    pubkey: publicKey,
  });
  extension.getPublicKey = async () => '0'.repeat(64);
  await expect(signer.sign(template)).rejects.toThrow('changed');
  delete window.nostr;
  await expect(signer.sign(template)).rejects.toThrow('changed');
});
it.each(['pubkey', 'kind', 'content', 'created_at', 'tags', 'sig'])(
  'rejects a signer that changes %s',
  async field => {
    const extension = provider();
    const signer = await connectRadioSigner(user);
    const template = roomTemplate('chat', station, 'Hello');
    extension.signEvent = async () => ({
      ...signed(template),
      [field]: field === 'tags' ? [] : 'wrong',
    });
    await expect(signer.sign(template)).rejects.toThrow('unexpected');
  },
);

function relayFixture(fail = false) {
  const relays: Array<{
    connect: jest.Mock;
    close: jest.Mock;
    subscribe: jest.Mock;
    publish: jest.Mock;
    onclose?: () => void;
    onauth?: (template: EventTemplate) => Promise<Event>;
  }> = [];
  jest.mocked(Relay).mockImplementation(() => {
    const relay = {
      connect: jest.fn(async () => {
        if (fail) throw new Error('offline');
      }),
      close: jest.fn(),
      subscribe: jest.fn(() => ({ close: jest.fn() })),
      publish: jest.fn(async () => 'ok'),
    };
    relays.push(relay);
    return relay as unknown as Relay;
  });
  return relays;
}
it('subscribes visitors only to presence and filters unrelated or expired events', async () => {
  const relays = relayFixture();
  const receive = jest.fn();
  const error = jest.fn();
  const room = new RadioRoom(receive, error);
  await room.open(false);
  const [filters, callbacks] = relays[0].subscribe.mock.calls[0];
  expect(filters[0]['#t']).toEqual(['nowplaying']);
  const listening = signed(roomTemplate('listening', station, 'Music'));
  callbacks.onevent(listening);
  callbacks.onevent({
    ...listening,
    tags: listening.tags.filter(entry => entry[0] !== 'expiration'),
  });
  callbacks.onevent(signed(roomTemplate('chat', station, 'Chat')));
  callbacks.onevent({ ...listening, kind: 0 });
  callbacks.onevent({ ...listening, created_at: now + 1000 });
  callbacks.onevent({
    ...listening,
    tags: [
      ['t', 'radiostr'],
      ['expiration', '1'],
    ],
  });
  expect(receive).toHaveBeenCalledTimes(2);
  callbacks.onclose();
  expect(error).toHaveBeenCalled();
  room.close();
  callbacks.onevent(listening);
  callbacks.onclose();
  expect(receive).toHaveBeenCalledTimes(2);
  expect(relays[0].close).toHaveBeenCalled();
});
it('publishes verified events, restores favourites and tolerates a failed relay', async () => {
  const relays = relayFixture();
  const receive = jest.fn();
  const error = jest.fn();
  const room = new RadioRoom(receive, error);
  await expect(
    room.publish(roomTemplate('chat', station, 'Hi')),
  ).rejects.toThrow('Connect');
  provider();
  const signer = await connectRadioSigner(user);
  room.setSigner(signer);
  room.loadFavourites(publicKey);
  await room.open(true);
  room.setSigner(signer);
  expect(relays[0].subscribe.mock.calls[0][0][0]['#t']).toEqual(['radiostr']);
  const auth = {
    kind: 22242,
    content: '',
    created_at: now,
    tags: [
      ['relay', 'wss://relay.trustroots.org'],
      ['challenge', 'test'],
    ],
  };
  expect(await relays[0].onauth!(auth)).toMatchObject({
    ...auth,
    pubkey: publicKey,
  });
  room.loadFavourites(publicKey);
  const favourite = signed(roomTemplate('favourite', station, 'Favourite'));
  const callback = relays[0].subscribe.mock.calls[1][1];
  callback.onevent(favourite);
  callback.onevent(signed(roomTemplate('chat', station, 'Hi')));
  expect(receive).toHaveBeenCalledWith(favourite);
  relays[1].publish.mockRejectedValueOnce(new Error('offline'));
  await room.publish(roomTemplate('chat', station, 'Hi'));
  expect(receive).toHaveBeenCalledWith(
    expect.objectContaining({ content: 'Hi', pubkey: publicKey }),
  );
  relays.forEach(relay =>
    relay.publish.mockRejectedValue(new Error('offline')),
  );
  await expect(
    room.publish(roomTemplate('chat', station, 'Hi')),
  ).rejects.toThrow('Could not publish');
  relays[0].onclose!();
  expect(error).not.toHaveBeenCalled();
  relays[1].onclose!();
  expect(error).toHaveBeenCalled();
  room.close();
  callback.onevent(favourite);
});
it('closes pending connections and fails publications after unmount', async () => {
  const relays = relayFixture();
  const error = jest.fn();
  const room = new RadioRoom(jest.fn(), error);
  const opening = room.open(false);
  room.close();
  await opening;
  expect(relays[0].close).toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
  const nextRelays = relayFixture();
  const next = new RadioRoom(jest.fn(), error);
  const connecting = next.open(false);
  nextRelays.forEach(relay =>
    relay.connect.mockRejectedValue(new Error('offline')),
  );
  await connecting;
  next.close();
  provider();
  const signer = await connectRadioSigner(user);
  const last = new RadioRoom(jest.fn(), error);
  await last.open(true);
  last.setSigner({
    ...signer,
    sign: async template => {
      last.close();
      return signer.sign(template);
    },
  });
  await expect(
    last.publish(roomTemplate('chat', station, 'Hi')),
  ).rejects.toThrow('closed');
});

it('reports an unavailable room when both connections fail', async () => {
  const relays = relayFixture(true);
  const error = jest.fn();
  const room = new RadioRoom(jest.fn(), error);
  await room.open(false);
  expect(error).toHaveBeenCalled();
  expect(relays.every(relay => relay.close.mock.calls.length > 0)).toBe(true);
  room.close();
});
