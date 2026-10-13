import '@testing-library/jest-dom';
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import L from 'leaflet';
import type { Event } from 'nostr-tools';
import CircleLocationMap, {
  locationPopup,
  type CircleLocation,
} from '@/modules/tribes/client/components/CircleLocationMap';
import { useCircleMapEvents } from '@/modules/tribes/client/hooks/useCircleMapEvents';
import type NostrService from '@/modules/search/client/services/nostr.client.service';

jest.mock('leaflet', () => {
  const map = {
    setView: jest.fn().mockReturnThis(),
    remove: jest.fn(),
    fitBounds: jest.fn(),
  };
  const group = { addTo: jest.fn().mockReturnThis(), clearLayers: jest.fn() };
  return {
    __esModule: true,
    default: {
      map: jest.fn(() => map),
      tileLayer: jest.fn(() => ({ addTo: jest.fn() })),
      layerGroup: jest.fn(() => group),
      circleMarker: jest.fn(() => ({
        bindPopup: jest.fn().mockReturnThis(),
        addTo: jest.fn(),
      })),
      latLngBounds: jest.fn(value => value),
    },
  };
});
jest.mock('@/modules/core/client/utils/map', () => ({
  getRasterMapTiles: () => ({
    url: 'https://tiles.test/{z}/{x}/{y}',
    options: {},
  }),
}));

const location: CircleLocation = {
  id: 'example',
  name: '<b>Example</b>',
  latitude: 12,
  longitude: 34,
  details: ['<script>untrusted</script>'],
  link: { url: 'https://example.test/', label: 'Source' },
};
const props = {
  title: 'Circle locations',
  mapLabel: 'Locations map',
  description: 'Source-reported',
  locations: [location],
  state: 'ready' as const,
  loadingText: 'Loading',
  emptyText: 'Empty',
  errorText: 'Unavailable',
  countLabel: 'places',
};

describe('shared circle map', () => {
  it('renders markers, safe text popups and attribution, and removes its map', () => {
    const { unmount, rerender } = render(
      <CircleLocationMap {...props} attribution="Source attribution" />,
    );
    expect(screen.getByText('1 places')).toBeInTheDocument();
    expect(screen.getByText('Source attribution')).toBeInTheDocument();
    expect(L.circleMarker).toHaveBeenCalledWith(
      [12, 34],
      expect.objectContaining({ fillColor: '#488261' }),
    );
    rerender(
      <CircleLocationMap
        {...props}
        markerColor="#12b591"
        className="circle-location-map-panel--brand"
      />,
    );
    expect(screen.getByLabelText('Circle locations')).toHaveClass(
      'circle-location-map-panel--brand',
    );
    expect(L.circleMarker).toHaveBeenCalledWith(
      [12, 34],
      expect.objectContaining({ fillColor: '#12b591' }),
    );
    const popup = locationPopup(location);
    expect(popup.querySelector('b')).toBeNull();
    expect(popup.querySelector('script')).toBeNull();
    expect(popup.querySelector('a')).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(
      locationPopup({
        ...location,
        link: { url: 'javascript:alert(1)', label: 'Bad' },
      }).querySelector('a'),
    ).toBeNull();
    expect(
      locationPopup({ ...location, link: undefined }).querySelector('a'),
    ).toBeNull();
    rerender(<CircleLocationMap {...props} locations={[]} />);
    expect(screen.getByText('Empty')).toBeInTheDocument();
    rerender(<CircleLocationMap {...props} state="loading" />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    rerender(<CircleLocationMap {...props} state="error" />);
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    unmount();
    expect(jest.mocked(L.map).mock.results[0].value.remove).toHaveBeenCalled();
  });
});

describe('shared circle relay lifecycle', () => {
  const filters = [{ kinds: [33000] }];
  let callbacks: {
    onevent: (event: Event) => void;
    oneose: () => void;
    onclose: () => void;
  };
  const close = jest.fn();
  const subscribe = jest.fn((_filters, cb) => {
    callbacks = cb;
    return { close };
  });
  const connect = jest.fn();
  const disconnect = jest.fn();
  const service = { connect, disconnect } as unknown as NostrService;
  function Consumer({ own }: { own?: boolean }) {
    const { events, state } = useCircleMapEvents(service, filters, own);
    return (
      <div>
        {state}:{events.length}
      </div>
    );
  }
  beforeEach(() => {
    jest.clearAllMocks();
    connect.mockResolvedValue({ subscribe });
  });
  it('subscribes once, replaces repeated ids, handles lifecycle and closes on unmount', async () => {
    const { unmount } = render(<Consumer />);
    await waitFor(() =>
      expect(subscribe).toHaveBeenCalledWith(filters, expect.any(Object)),
    );
    const event = {
      id: 'example',
      kind: 33000,
      tags: [],
      pubkey: 'fictional',
      created_at: 1,
    } as unknown as Event;
    act(() => {
      callbacks.onevent(event);
      callbacks.onevent(event);
      callbacks.oneose();
    });
    expect(screen.getByText('ready:1')).toBeInTheDocument();
    act(() => callbacks.onclose());
    expect(screen.getByText('error:1')).toBeInTheDocument();
    unmount();
    act(() => {
      callbacks.onevent(event);
      callbacks.oneose();
      callbacks.onclose();
    });
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('reports connection failures', async () => {
    connect.mockRejectedValue(new Error('offline'));
    render(<Consumer />);
    expect(await screen.findByText('error:0')).toBeInTheDocument();
  });
  it.each([false, true])(
    'does not subscribe after unmount, including rejected connections (owned: %s)',
    async own => {
      let resolve!: (relay: unknown) => void;
      connect.mockReturnValue(
        new Promise(done => {
          resolve = done;
        }),
      );
      const first = render(<Consumer own={own} />);
      first.unmount();
      await act(async () => resolve({ subscribe }));
      expect(subscribe).not.toHaveBeenCalled();
      expect(disconnect).toHaveBeenCalledTimes(own ? 2 : 0);
      let reject!: (reason: Error) => void;
      connect.mockReturnValue(
        new Promise((_done, fail) => {
          reject = fail;
        }),
      );
      const second = render(<Consumer />);
      second.unmount();
      await act(async () => reject(new Error('offline')));
    },
  );
});
