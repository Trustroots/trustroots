import { malformedFixture } from '@/testutils/client/malformed-fixtures';
import React from 'react';
import { render } from '@testing-library/react';
import L from 'leaflet';

import LeafletMap from '@/modules/core/client/components/Map/LeafletMap';

type MoveListener = (event: L.LeafletMouseEvent) => void;
const mockMap = {
  on: vi.fn<(...args: [event: string, listener: MoveListener]) => void>(),
  getCenter: vi.fn(),
  getZoom: vi.fn(),
  invalidateSize: vi.fn(),
  remove: vi.fn(),
  setView: vi.fn(),
};
mockMap.setView.mockImplementation(() => mockMap);
const mockMarker = { remove: vi.fn() };

vi.mock('leaflet', () => ({
  circleMarker: vi.fn(() => ({
    addTo: vi.fn(() => mockMarker),
  })),
  map: vi.fn(() => mockMap),
  tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
}));

beforeEach(() => {
  mockMap.getCenter.mockReturnValue({ lat: 50.12, lng: 19.89 });
  mockMap.getZoom.mockReturnValue(11);
  mockMap.on.mockClear();
  mockMap.remove.mockClear();
  mockMap.setView.mockClear();
  mockMarker.remove.mockClear();
  vi.mocked(L.circleMarker).mockClear();
  vi.mocked(L.map).mockClear();
  vi.mocked(L.tileLayer).mockClear();
});

describe('<LeafletMap />', () => {
  it('refreshes tiles when a hidden tab becomes visible and stops observing on unmount', () => {
    const original = global.ResizeObserver;
    let resize!: () => void;
    const observe = vi.fn();
    const disconnect = vi.fn();
    global.ResizeObserver = vi.fn(callback => {
      resize = () => callback([], {} as ResizeObserver);
      return { observe, disconnect, unobserve: vi.fn() };
    });
    try {
      const { container, unmount } = render(<LeafletMap location={[35, -7]} />);
      expect(observe).toHaveBeenCalledWith(container.firstChild);
      resize();
      expect(mockMap.invalidateSize).toHaveBeenCalledWith({ animate: false });
      unmount();
      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      global.ResizeObserver = original;
    }
  });

  it('renders raster tiles and the supplied marker', () => {
    const { container } = render(
      <LeafletMap
        ariaHidden
        className="offer-location"
        location={[50.12, 19.89]}
        marker={{ color: '#11b4da', location: [50.12, 19.89] }}
        scrollZoom={false}
        zoom={11}
      />,
    );

    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    expect(L.map).toHaveBeenCalledWith(expect.any(HTMLDivElement), {
      scrollWheelZoom: false,
      zoomControl: true,
    });
    expect(L.tileLayer).toHaveBeenCalledWith(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      expect.objectContaining({ maxZoom: 19 }),
    );
    expect(L.circleMarker).toHaveBeenCalledWith(
      [50.12, 19.89],
      expect.objectContaining({ fillColor: '#11b4da', radius: 12 }),
    );
  });

  it('follows a changed location and cleans up the map and marker', () => {
    const { rerender, unmount } = render(
      <LeafletMap
        location={[50.12, 19.89]}
        marker={{ color: '#11b4da', location: [50.12, 19.89] }}
        zoom={11}
      />,
    );

    rerender(
      <LeafletMap
        location={[51.12, 20.89]}
        marker={{ color: '#58ba58', location: [51.12, 20.89] }}
        zoom={12}
      />,
    );

    expect(mockMap.setView).toHaveBeenCalledWith([51.12, 20.89], 12);
    expect(mockMarker.remove).toHaveBeenCalled();

    unmount();
    expect(mockMap.remove).toHaveBeenCalledTimes(1);
  });

  it('uses the default zoom and accepts a map without a marker', () => {
    render(<LeafletMap location={[50.12, 19.89]} />);

    expect(mockMap.setView).toHaveBeenCalledWith([50.12, 19.89], 6);
    expect(L.circleMarker).not.toHaveBeenCalled();
  });

  it('does not update the map when no location is available', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // The null location exercises the component's runtime guard for malformed data.
    render(
      <LeafletMap
        {...malformedFixture(
          { location: [0, 0] as [number, number] },
          { location: null },
        )}
      />,
    );

    expect(mockMap.setView).toHaveBeenCalledTimes(1);
    expect(L.circleMarker).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

it('reports the panned centre to the latest listener without resetting zoom', () => {
  const first = vi.fn();
  const latest = vi.fn();
  const { rerender } = render(
    <LeafletMap location={[50.12, 19.89]} zoom={11} onLocationChange={first} />,
  );
  const start = mockMap.on.mock.calls.find(
    ([name]) => name === 'dragstart',
  )?.[1];
  const move = mockMap.on.mock.calls.find(([name]) => name === 'moveend')?.[1];
  rerender(
    <LeafletMap
      location={[50.12, 19.89]}
      zoom={11}
      onLocationChange={latest}
    />,
  );
  mockMap.getCenter.mockReturnValue({ lat: 51, lng: 20 });
  mockMap.getZoom.mockReturnValue(15);
  if (!move || !start) {
    throw new Error('Expected Leaflet to register a move listener');
  }
  move!({} as L.LeafletMouseEvent);
  expect(latest).not.toHaveBeenCalled();
  start({} as L.LeafletMouseEvent);
  move({} as L.LeafletMouseEvent);
  expect(latest).toHaveBeenCalledWith([51, 20]);
  expect(first).not.toHaveBeenCalled();
  mockMap.setView.mockClear();
  rerender(
    <LeafletMap location={[51, 20]} zoom={11} onLocationChange={latest} />,
  );
  expect(mockMap.setView).not.toHaveBeenCalled();
  rerender(<LeafletMap location={[52, 21]} zoom={11} />);
  expect(mockMap.setView).toHaveBeenCalledWith([52, 21], 15);
  start({} as L.LeafletMouseEvent);
  expect(() => move!({} as L.LeafletMouseEvent)).not.toThrow();
});

it('chooses a clicked location and accepts clicks without a callback', () => {
  const onLocationChange = vi.fn();
  const { rerender } = render(
    <LeafletMap location={[35, -7]} onLocationChange={onLocationChange} />,
  );
  const click = mockMap.on.mock.calls.find(([name]) => name === 'click')?.[1];
  if (!click) throw new Error('Expected a map click listener');
  const event = { latlng: { lat: 36, lng: -8 } } as L.LeafletMouseEvent;
  click(event);
  expect(onLocationChange).toHaveBeenCalledWith([36, -8]);
  rerender(<LeafletMap location={[35, -7]} />);
  expect(() => click(event)).not.toThrow();
});
