import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { Event } from 'nostr-tools';
import CircleLocationMap, {
  LocationPopup,
  type CircleLocation,
} from '@/modules/tribes/client/components/CircleLocationMap';
import { useCircleMapEvents } from '@/modules/tribes/client/hooks/useCircleMapEvents';
import type NostrService from '@/modules/search/client/services/nostr.client.service';
import type {
  MapBounds,
  MapProps,
} from '@/modules/core/client/components/Map/types';

const mockMap = { fitBounds: vi.fn(), flyTo: vi.fn(), setPointState: vi.fn() };
let mockMapProps: MapProps;
vi.mock('@/modules/core/client/components/Map/index', () => ({
  default: function MockMap(props: MapProps) {
    mockMapProps = props;
    React.useImperativeHandle(props.ref, () => mockMap);
    return (
      <div>
        {props.pins?.map(pin => (
          <React.Fragment key={pin.key}>{pin.children}</React.Fragment>
        ))}
        {props.popup && <div role="dialog">{props.popup.children}</div>}
      </div>
    );
  },
}));
vi.mock('@/modules/core/client/components/DeviceLocationButton', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  type mockButtonProps = {
    onRequest?: () => void;
    onLocation: (location: { lat: number; lng: number }) => void;
    onApproximateLocation: (location: {
      latitude: number;
      longitude: number;
      zoom: number;
    }) => void;
  };
  return {
    __esModule: true,
    default: ({
      onRequest,
      onLocation,
      onApproximateLocation,
    }: mockButtonProps) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: () => {
              onRequest?.();
              onLocation({ lat: 0, lng: 0 });
            },
          },
          'Mock device location',
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: () => {
              onRequest?.();
              onApproximateLocation({
                latitude: 34,
                longitude: -17,
                zoom: 6,
              });
            },
          },
          'Mock approximate location',
        ),
      ),
  };
});

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

const loadMap = () =>
  act(() => mockMapProps.onLoad!(mockMapProps.view, {} as MapBounds));
const moveEnd = (latitude = 12, longitude = 34, zoom = 6) =>
  act(() =>
    mockMapProps.onMoveEnd!(
      { latitude, longitude, zoom },
      {} as MapBounds,
      true,
    ),
  );
const renderPopup = (popupLocation: CircleLocation) =>
  render(<LocationPopup location={popupLocation} />).container;
const markerButton = () =>
  screen.getByRole('button', { name: '<b>Example</b>' });

describe('shared circle map', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('restores the chosen view when opening another circle map', () => {
    const { unmount } = render(<CircleLocationMap {...props} />);
    expect(mockMapProps.view).toEqual({
      latitude: 20,
      longitude: 0,
      zoom: 1,
    });
    moveEnd();
    unmount();
    render(<CircleLocationMap {...props} />);
    loadMap();
    expect(mockMapProps.view).toEqual({
      latitude: 12,
      longitude: 34,
      zoom: 6,
    });
    expect(mockMap.fitBounds).not.toHaveBeenCalled();
  });

  it.each([
    '[12, 34]',
    '[12, 34, 0]',
    '[86, 34, 6]',
    '[12, 181, 6]',
    '[12, 34, 25]',
    'not json',
  ])('ignores a saved view that is not usable (%s)', saved => {
    sessionStorage.setItem('circle-map-view', saved);
    render(<CircleLocationMap {...props} />);
    expect(mockMapProps.view.zoom).toBe(1);
  });

  it('does not save the automatic initial fit as a chosen view', () => {
    mockMap.fitBounds.mockImplementationOnce(() => moveEnd());
    render(<CircleLocationMap {...props} />);
    loadMap();
    expect(mockMap.fitBounds).toHaveBeenCalled();
    expect(sessionStorage.getItem('circle-map-view')).toBeNull();
  });

  it('continues to work if session storage is unavailable', () => {
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('unavailable');
      });
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('unavailable');
      });
    try {
      render(<CircleLocationMap {...props} />);
      expect(() => moveEnd()).not.toThrow();
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });

  it('fits the initial results without animation, then preserves the view on live updates', () => {
    const { rerender } = render(
      <CircleLocationMap {...props} locations={[]} state="loading" />,
    );
    loadMap();
    rerender(<CircleLocationMap {...props} state="loading" />);
    const second = { ...location, id: 'second', latitude: -30, longitude: -80 };
    const locations = [location, second];
    rerender(
      <CircleLocationMap {...props} locations={locations} state="loading" />,
    );
    expect(mockMap.fitBounds).not.toHaveBeenCalled();
    rerender(<CircleLocationMap {...props} locations={locations} />);
    expect(mockMap.fitBounds).toHaveBeenCalledWith(
      {
        northEast: { lat: 12, lng: 34 },
        southWest: { lat: -30, lng: -80 },
      },
      { padding: 24, maxZoom: 8, animate: false },
    );
    rerender(<CircleLocationMap {...props} locations={[second]} />);
    expect(mockMap.fitBounds).toHaveBeenCalledTimes(1);
    expect(
      screen.getAllByRole('button', { name: '<b>Example</b>' }),
    ).toHaveLength(1);
  });

  it('waits for the map to load before fitting results', () => {
    render(<CircleLocationMap {...props} />);
    expect(mockMap.fitBounds).not.toHaveBeenCalled();
    loadMap();
    expect(mockMap.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('preserves a view chosen before the initial locations finish loading', () => {
    const { rerender } = render(
      <CircleLocationMap {...props} state="loading" />,
    );
    loadMap();
    act(() => mockMapProps.onMoveStart!());
    rerender(<CircleLocationMap {...props} />);
    expect(mockMap.fitBounds).not.toHaveBeenCalled();
  });

  it('centres precisely on device location and keeps late relay results from resetting the view', () => {
    const { rerender } = render(
      <CircleLocationMap {...props} locations={[]} state="loading" />,
    );
    loadMap();
    moveEnd();
    fireEvent.click(
      screen.getByRole('button', { name: 'Mock device location' }),
    );
    expect(mockMap.flyTo).toHaveBeenCalledWith(
      { latitude: 0, longitude: 0, zoom: 13 },
      false,
    );
    moveEnd(0, 0, 13);
    moveEnd(0.002, 0.003, 14);
    expect(sessionStorage.getItem('circle-map-view')).toBe('[12,34,6]');
    rerender(<CircleLocationMap {...props} />);
    expect(mockMap.fitBounds).not.toHaveBeenCalled();
  });

  it('uses the approximate fallback location and zoom after a device failure', () => {
    render(<CircleLocationMap {...props} locations={[]} state="loading" />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Mock approximate location' }),
    );
    expect(mockMap.flyTo).toHaveBeenCalledWith(
      { latitude: 34, longitude: -17, zoom: 6 },
      false,
    );
    moveEnd(34, -17, 6);
    expect(sessionStorage.getItem('circle-map-view')).toBeNull();
  });

  it('opens a popup for the selected marker and keeps it open when locations are refreshed', () => {
    const { rerender } = render(<CircleLocationMap {...props} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(markerButton(), { detail: 1 });
    expect(screen.getByRole('dialog')).toHaveTextContent('<b>Example</b>');
    expect(screen.getByRole('link', { name: 'Source' })).not.toHaveFocus();
    rerender(<CircleLocationMap {...props} locations={[{ ...location }]} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close popup' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(markerButton());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    act(() => mockMapProps.onClick!([0, 0]));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(markerButton());
    rerender(<CircleLocationMap {...props} locations={[]} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves keyboard focus to the popup action', () => {
    render(
      <CircleLocationMap
        {...props}
        locations={[{ ...location, popupHeading: <span>Custom heading</span> }]}
      />,
    );
    fireEvent.click(markerButton(), { detail: 0 });
    expect(screen.getByText('Custom heading')).toBeInTheDocument();
    const action = screen.getByRole('link', { name: 'Source' });
    expect(action).toHaveFocus();
    markerButton().focus();
    fireEvent.click(markerButton(), { detail: 0 });
    expect(action).toHaveFocus();
    markerButton().focus();
    fireEvent.click(markerButton(), { detail: 1 });
    expect(action).not.toHaveFocus();
  });

  it('renders markers, attribution, legend and status text', () => {
    const { rerender } = render(
      <CircleLocationMap {...props} attribution="Source attribution" />,
    );
    expect(screen.getByText('1 places')).toBeInTheDocument();
    expect(screen.getByText(/Source attribution/)).toBeInTheDocument();
    expect(screen.getByRole('application')).toHaveAccessibleName(
      'Locations map',
    );
    expect(markerButton()).toHaveStyle({ backgroundColor: '#488261' });
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
    expect(markerButton()).toHaveStyle({ backgroundColor: '#12b591' });
    rerender(
      <CircleLocationMap
        {...props}
        headingAs="h2"
        legend={<div>Meeting location</div>}
        locations={[{ ...location, markerColor: '#b16a19' }]}
        markerColor="#12b591"
      />,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Circle locations',
    );
    expect(screen.getByText('Meeting location')).toBeInTheDocument();
    expect(markerButton()).toHaveStyle({ backgroundColor: '#b16a19' });
    rerender(<CircleLocationMap {...props} locations={[]} />);
    expect(screen.getByText('Empty')).toBeInTheDocument();
    rerender(<CircleLocationMap {...props} state="loading" />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    rerender(<CircleLocationMap {...props} state="error" />);
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('renders popup text and links safely', () => {
    const accommodation = '/profile/sample/accommodation';
    const internalLink = renderPopup({
      ...location,
      link: { url: accommodation, label: 'Hosting' },
    }).querySelector('a');
    expect(internalLink).toHaveAttribute('href', accommodation);
    expect(internalLink).not.toHaveAttribute('target');
    const popup = renderPopup(location);
    expect(popup).toHaveTextContent('<b>Example</b>');
    expect(popup).toHaveTextContent('<script>untrusted</script>');
    expect(popup.querySelector('b, script')).toBeNull();
    expect(popup.querySelector('a')).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(popup.querySelector('a')).toHaveAttribute('target', '_blank');
    expect(
      renderPopup({
        ...location,
        link: { url: 'javascript:alert(1)', label: 'Bad' },
      }).querySelector('a'),
    ).toBeNull();
    expect(
      renderPopup({ ...location, link: undefined }).querySelector('a'),
    ).toBeNull();
  });

  it('renders labelled popup facts as safe text and handles empty facts', () => {
    const popup = renderPopup({
      ...location,
      facts: [{ label: '<b>Signal</b>', value: '<img src=x>Thumb' }],
    });
    expect(popup.querySelector('dt')).toHaveTextContent('<b>Signal</b>');
    expect(popup.querySelector('dd')).toHaveTextContent('<img src=x>Thumb');
    expect(popup.querySelector('img')).toBeNull();
    expect(
      renderPopup({ ...location, facts: [] }).querySelector('dl'),
    ).toBeNull();
  });

  it('renders linked fact lists safely and leaves anonymous and unsafe URLs unlinked', () => {
    const popup = renderPopup({
      ...location,
      facts: [
        {
          label: 'Hitchhikers',
          value: [
            {
              label: '<img src=x>ExampleHiker',
              url: 'https://maps.hitchwiki.org/account/ExampleHiker',
            },
            { label: 'Anonymous' },
            { label: '<script>Other</script>', url: 'javascript:alert(1)' },
          ],
        },
      ],
    });
    const definition = popup.querySelector('dd')!;
    expect(definition).toHaveTextContent(
      '<img src=x>ExampleHiker, Anonymous, <script>Other</script>',
    );
    expect(definition.querySelectorAll('a')).toHaveLength(1);
    expect(definition.querySelector('a')).toHaveAttribute(
      'href',
      'https://maps.hitchwiki.org/account/ExampleHiker',
    );
    expect(definition.querySelector('a')).toHaveAttribute('target', '_blank');
    expect(definition.querySelector('a')).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(definition.querySelector('img, script')).toBeNull();
  });
});

describe('shared circle relay lifecycle', () => {
  const filters = [{ kinds: [33000] }];
  let callbacks: {
    onevent: (event: Event) => void;
    oneose: () => void;
    onclose: () => void;
  };
  const close = vi.fn();
  const subscribe = vi.fn((_filters, cb) => {
    callbacks = cb;
    return { close };
  });
  const connect = vi.fn();
  const disconnect = vi.fn();
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
    vi.clearAllMocks();
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
