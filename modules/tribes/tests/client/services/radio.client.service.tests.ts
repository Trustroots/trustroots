import type { Mock } from 'vitest';
import {
  finalizeEvent,
  generateSecretKey,
  type EventTemplate,
} from 'nostr-tools';
import { chatTemplate } from '@/modules/tribes/shared/circle-chat';
import http from '@trustroots/core/http-client';
import { Relay } from 'nostr-tools/relay';
import {
  activeListeners,
  FAVOURITES_KEY,
  fetchRadioAuthorUsernames,
  LISTENER_TTL,
  RadioRoom,
  readFavourites,
  saveFavourites,
  stationFromHash,
  stationGroups,
  stations,
  type Station,
  tag,
} from '@/modules/tribes/client/services/radio.client.service';

vi.mock('@trustroots/core/http-client', () => ({
  __esModule: true,
  default: { get: vi.fn() },
}));
vi.mock('nostr-tools/relay', () => ({ Relay: vi.fn() }));
const secret = generateSecretKey();
const station = stations[0];
const second = stations[1];
const now = Math.floor(Date.now() / 1000);
const signed = (template: EventTemplate) => finalizeEvent(template, secret);

function listeningTemplate(
  station: Station,
  content: string,
  created_at = now,
): EventTemplate {
  return {
    kind: 1,
    created_at,
    content,
    tags: [
      ['t', 'radiostr'],
      ['t', 'nowplaying'],
      ['radiostr_station', station.id],
      ['expiration', String(created_at + 30 * 24 * 60 * 60)],
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

it('resolves profiles in batches of up to 100 public keys', async () => {
  const keys = Array.from({ length: 101 }, (_, index) =>
    index.toString(16).padStart(64, '0'),
  );
  const { signal } = new AbortController();
  vi.mocked(http.get)
    .mockResolvedValueOnce({
      data: { usernames: { [keys[0]]: 'fictional-member' } },
    })
    .mockResolvedValueOnce({ data: {} });
  await expect(fetchRadioAuthorUsernames(keys, signal)).resolves.toEqual({
    [keys[0]]: 'fictional-member',
  });
  expect(
    vi.mocked(http.get).mock.calls.map(([path, config]) => {
      const url = new URL(path, 'https://example.test');
      expect(url.pathname).toBe('/api/nostr/author-visibility');
      expect(url.searchParams.get('profiles')).toBe('1');
      expect(config?.signal).toBe(signal);
      return url.searchParams.getAll('pubkey');
    }),
  ).toEqual([keys.slice(0, 100), keys.slice(100)]);
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
  const listening = signed(listeningTemplate(station, station.title));
  expect(tag(listening, 'radiostr_station')).toBe(station.id);
  expect(tag(listening, 'absent')).toBeUndefined();
});

it('deduplicates listeners, chooses newest stations and expires shared activity', () => {
  const listening = signed(listeningTemplate(station, 'Station', now));
  const newer = signed(listeningTemplate(second, 'New station', now + 1));
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
    activeListeners([signed(chatTemplate('radio', 'chat', station.id))]),
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

it('handles corrupt, blocked and unavailable browser storage', () => {
  expect(readFavourites()).toEqual([]);
  saveFavourites([station.id, station.id, 'unknown']);
  expect(readFavourites()).toEqual([station.id]);
  localStorage.setItem(FAVOURITES_KEY, '{}');
  expect(readFavourites()).toEqual([]);
  localStorage.setItem(FAVOURITES_KEY, '{');
  expect(readFavourites()).toEqual([]);
  const fail = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(() => saveFavourites([], 'custom')).not.toThrow();
  fail.mockRestore();
});

function relayFixture(fail = false) {
  const relays: Array<{
    connect: Mock;
    close: Mock;
    subscribe: Mock;
    publish: Mock;
    onclose?: () => void;
  }> = [];
  vi.mocked(Relay).mockImplementation(function () {
    const relay = {
      connect: vi.fn(async () => {
        if (fail) throw new Error('offline');
      }),
      close: vi.fn(),
      subscribe: vi.fn(() => ({ close: vi.fn() })),
      publish: vi.fn(async () => 'ok'),
    };
    relays.push(relay);
    return relay as unknown as Relay;
  });
  return relays;
}
it('subscribes visitors only to presence and filters unrelated or expired events', async () => {
  const relays = relayFixture();
  const receive = vi.fn();
  const error = vi.fn();
  const room = new RadioRoom(receive, error);
  await room.open();
  const [filters, callbacks] = relays[0].subscribe.mock.calls[0];
  expect(filters[0]['#t']).toEqual(['nowplaying']);
  const listening = signed(listeningTemplate(station, 'Music'));
  callbacks.onevent(listening);
  callbacks.onevent({
    ...listening,
    tags: listening.tags.filter(entry => entry[0] !== 'expiration'),
  });
  callbacks.onevent(signed(chatTemplate('radio', 'Chat', station.id)));
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
  expect(relays.every(relay => relay.publish.mock.calls.length === 0)).toBe(
    true,
  );
  callbacks.onclose();
  expect(error).toHaveBeenCalled();
  room.close();
  callbacks.onevent(listening);
  callbacks.onclose();
  expect(receive).toHaveBeenCalledTimes(2);
  expect(relays[0].close).toHaveBeenCalled();
});
it('closes pending connections without reporting errors after unmount', async () => {
  const relays = relayFixture();
  const error = vi.fn();
  const room = new RadioRoom(vi.fn(), error);
  const opening = room.open();
  room.close();
  await opening;
  expect(relays[0].close).toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
  const nextRelays = relayFixture();
  const next = new RadioRoom(vi.fn(), error);
  const connecting = next.open();
  nextRelays.forEach(relay =>
    relay.connect.mockRejectedValue(new Error('offline')),
  );
  await connecting;
  next.close();
});

it('reports disconnection only after the last public relay closes', async () => {
  const relays = relayFixture();
  const error = vi.fn();
  const room = new RadioRoom(vi.fn(), error);
  await room.open();
  relays[0].onclose?.();
  expect(error).not.toHaveBeenCalled();
  relays[1].onclose?.();
  expect(error).toHaveBeenCalledOnce();
  room.close();
  relays[1].onclose?.();
  expect(error).toHaveBeenCalledOnce();
});

it('reports an unavailable room when both connections fail', async () => {
  const relays = relayFixture(true);
  const error = vi.fn();
  const room = new RadioRoom(vi.fn(), error);
  await room.open();
  expect(error).toHaveBeenCalled();
  expect(relays.every(relay => relay.close.mock.calls.length > 0)).toBe(true);
  room.close();
});
