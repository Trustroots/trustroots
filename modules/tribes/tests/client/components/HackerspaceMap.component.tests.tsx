import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Event } from 'nostr-tools';
import HackerspaceMap, {
  decodeGeohash,
  parseHackerPlace,
} from '@/modules/tribes/client/components/HackerspaceMap';

jest.mock('leaflet', () => ({
  __esModule: true,
  default: {
    map: jest.fn(),
    tileLayer: jest.fn(),
    layerGroup: jest.fn(),
    circleMarker: jest.fn(),
    latLngBounds: jest.fn(points => points),
  },
}));
jest.mock('@/modules/core/client/utils/map', () => ({
  getRasterMapTiles: () => ({
    url: 'https://tiles.example.test/{z}/{x}/{y}',
    options: {},
  }),
}));
jest.mock('@/modules/search/client/services/nostr.client.service', () => ({
  nostrService: {
    subscribeHackerPlaces: jest.fn(),
    unsubscribeHackerPlaces: jest.fn(),
  },
}));
const leaflet = jest.requireMock('leaflet').default as Record<
  string,
  jest.Mock
>;
const service = jest.requireMock(
  '@/modules/search/client/services/nostr.client.service',
).nostrService as {
  subscribeHackerPlaces: jest.Mock;
  unsubscribeHackerPlaces: jest.Mock;
};
function place(tags: string[][] = [], content = ''): Event {
  return {
    id: 'event-id',
    pubkey: 'fictional-key',
    sig: 'fictional-signature',
    kind: 33000,
    created_at: 1,
    content,
    tags: [
      ['meta', 'source', 'https://api.spaceapi.io/'],
      ['name', 'Example Workshop'],
      ['g', 'gcpvj0'],
      ...tags,
    ],
  };
}
function callbacks() {
  const [onevent, lifecycle] = service.subscribeHackerPlaces.mock.calls[0] as [
    (event: Event) => void,
    { onEose: () => void; onClose: () => void },
  ];
  return { onevent, ...lifecycle };
}

describe('public hackerspace map', () => {
  const map = { setView: jest.fn(), remove: jest.fn(), fitBounds: jest.fn() };
  const markers = { addTo: jest.fn(), clearLayers: jest.fn() };
  const marker = { bindPopup: jest.fn(), addTo: jest.fn() };
  beforeEach(() => {
    jest.clearAllMocks();
    service.subscribeHackerPlaces.mockResolvedValue(undefined);
    leaflet.map.mockReturnValue(map);
    map.setView.mockReturnValue(map);
    leaflet.tileLayer.mockReturnValue({ addTo: jest.fn() });
    leaflet.layerGroup.mockReturnValue(markers);
    markers.addTo.mockReturnValue(markers);
    leaflet.circleMarker.mockReturnValue(marker);
    marker.bindPopup.mockReturnValue(marker);
  });
  it('shows loading and empty states and cleans up map and subscription', () => {
    const { unmount } = render(<HackerspaceMap />);
    expect(
      screen.getByText('Loading places from Trustroots relay…'),
    ).toBeVisible();
    act(() => callbacks().onEose());
    expect(
      screen.getByText('No place events are available yet.'),
    ).toBeVisible();
    expect(leaflet.tileLayer).toHaveBeenCalledWith(
      'https://tiles.example.test/{z}/{x}/{y}',
      {},
    );
    unmount();
    expect(map.remove).toHaveBeenCalledTimes(1);
    expect(service.unsubscribeHackerPlaces).toHaveBeenCalledTimes(1);
    act(() => {
      callbacks().onEose();
      callbacks().onClose();
      callbacks().onevent(place());
    });
    expect(leaflet.circleMarker).not.toHaveBeenCalled();
  });
  it('renders safe popup details, replaces stable identifiers and hides inactive places', () => {
    render(<HackerspaceMap />);
    act(() => {
      callbacks().onevent(
        place(
          [
            ['d', 'spaceapi:example'],
            ['address', '1 Fictional Road'],
            ['website', 'https://workshop.example.test'],
            ['meta', 'open', 'closed'],
            ['meta', 'fetched_at', '2026-10-12T10:00:00Z'],
          ],
          '<img src=x onerror=alert(1)>',
        ),
      );
      callbacks().onEose();
    });
    expect(screen.getByText('1 SpaceAPI-reported places')).toBeVisible();
    const popup = marker.bindPopup.mock.calls[0][0] as HTMLElement;
    expect(popup).toHaveTextContent('1 Fictional Road');
    expect(popup).toHaveTextContent('SpaceAPI-reported snapshot: closed');
    expect(popup).toHaveTextContent('Trustroots fetched: 2026-10-12T10:00:00Z');
    expect(popup.querySelector('img')).toBeNull();
    expect(popup.querySelector('a')).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(popup.querySelector('a')).toHaveAttribute(
      'href',
      'https://workshop.example.test',
    );
    expect(map.fitBounds).toHaveBeenCalled();
    act(() => callbacks().onevent(place([['d', 'spaceapi:example']])));
    expect(screen.getByText('1 SpaceAPI-reported places')).toBeVisible();
    const minimal = marker.bindPopup.mock.calls[
      marker.bindPopup.mock.calls.length - 1
    ][0] as HTMLElement;
    expect(minimal.querySelectorAll('p, a')).toHaveLength(0);
    const rendered = leaflet.circleMarker.mock.calls.length;
    act(() =>
      callbacks().onevent(
        place([
          ['d', 'spaceapi:example'],
          ['meta', 'status', 'inactive'],
        ]),
      ),
    );
    expect(leaflet.circleMarker).toHaveBeenCalledTimes(rendered);
    act(() => callbacks().onevent({ ...place(), tags: [] }));
    expect(leaflet.circleMarker).toHaveBeenCalledTimes(rendered);
  });
  it('shows relay closure and connection failures', async () => {
    const { unmount } = render(<HackerspaceMap />);
    act(() => callbacks().onClose());
    expect(
      screen.getByText('Places could not be loaded from the relay.'),
    ).toBeVisible();
    unmount();
    service.subscribeHackerPlaces.mockRejectedValue(new Error('offline'));
    render(<HackerspaceMap />);
    expect(
      await screen.findByText('Places could not be loaded from the relay.'),
    ).toBeVisible();
  });
  it('ignores a connection rejection after unmount', async () => {
    let reject!: (error: Error) => void;
    service.subscribeHackerPlaces.mockReturnValue(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    const { unmount } = render(<HackerspaceMap />);
    unmount();
    await act(async () => {
      reject(new Error('offline'));
    });
    expect(service.unsubscribeHackerPlaces).toHaveBeenCalled();
  });
});

describe('hackerspace place event parsing', () => {
  it('decodes a standard geohash to a location', () => {
    const point = decodeGeohash('gcpvj0');
    expect(point?.[0]).toBeCloseTo(51.5, 0);
    expect(point?.[1]).toBeCloseTo(-0.1, 0);
  });
  it('handles legacy metadata, multiple precisions, missing names and inactive states', () => {
    const legacy = place();
    legacy.tags = [
      ['meta:source', 'https://api.spaceapi.io/'],
      ['name', 'Legacy Workshop'],
      ['g', 'g'],
      ['g', ''],
      ['g', 'gcpvj0'],
      ['g', 'gc'],
      ['status', 'inactive'],
      ['website', 'javascript:invalid'],
    ];
    expect(parseHackerPlace(legacy)).toMatchObject({
      id: legacy.id,
      inactive: true,
      website: undefined,
    });
    expect(
      parseHackerPlace({
        ...legacy,
        tags: legacy.tags.filter(tag => tag[0] !== 'name'),
      }),
    ).toBeNull();
    expect(
      parseHackerPlace({
        ...place(),
        tags: [
          ['meta', 'source', 'https://api.spaceapi.io/'],
          ['name', 'Missing location'],
        ],
      }),
    ).toBeNull();
    expect(
      parseHackerPlace({
        ...legacy,
        tags: [['meta:source', 'https://unrelated.example.test/']],
      }),
    ).toBeNull();
    expect(decodeGeohash('')).toBeNull();
  });
  it('uses the stable identifier, location, source metadata and safe website', () => {
    expect(
      parseHackerPlace({
        id: 'event-id',
        content: 'Reported place',
        tags: [
          ['d', 'spaceapi:https://example.test/api'],
          ['meta', 'source', 'https://api.spaceapi.io/'],
          ['name', 'Example Workshop'],
          ['g', 'gcpvj0'],
          ['website', 'https://example.test'],
          ['meta', 'open', 'open'],
          ['meta', 'fetched_at', '2026-10-12T10:00:00Z'],
        ],
      }),
    ).toMatchObject({
      id: 'spaceapi:https://example.test/api',
      name: 'Example Workshop',
      website: 'https://example.test',
      open: 'open',
      fetchedAt: '2026-10-12T10:00:00Z',
    });
  });
  it('rejects malformed coordinates and unsafe links', () => {
    expect(decodeGeohash('!')).toBeNull();
    expect(
      parseHackerPlace({
        id: 'x',
        content: '',
        tags: [
          ['name', 'No location'],
          ['website', 'javascript:alert(1)'],
        ],
      }),
    ).toBeNull();
    expect(
      parseHackerPlace({
        id: 'x',
        content: '',
        tags: [
          ['name', 'No link'],
          ['g', 'gcpvj0'],
          ['website', 'javascript:alert(1)'],
        ],
      })?.website,
    ).toBeUndefined();
  });
});
