import React, { createRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import L from 'leaflet';

import LeafletMap from '@/modules/core/client/components/Map/LeafletMap';
import type {
  MapHandle,
  MapPointLayer,
  MapProps,
} from '@/modules/core/client/components/Map/types';

const view = { latitude: 50, longitude: 10, zoom: 5 };
const offers: MapPointLayer = {
  id: 'offers',
  minZoom: 2,
  clusterMaxZoom: 12,
  clusterColour: '#0f0',
  clusterTextColour: '#111',
  points: [
    { id: 1, latitude: 50, longitude: 10, colour: '#58ba58', properties: {} },
    {
      id: 2,
      latitude: 50,
      longitude: 10.0001,
      colour: '#11b4da',
      properties: {},
    },
    { id: 3, latitude: 51, longitude: 12, colour: '#f2ae43', properties: {} },
  ],
};

let resize: () => void;
const disconnect = vi.fn();
let map: L.Map;

beforeAll(() => {
  // Leaflet sizes the map from its container, which jsdom does not lay out.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
});

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn(function (callback: () => void) {
      resize = callback;
      return { observe: vi.fn(), disconnect, unobserve: vi.fn() };
    }),
  );
  const create = L.map;
  vi.spyOn(L, 'map').mockImplementation((...args) => {
    map = create(...args);
    return map;
  });
  vi.spyOn(L, 'circleMarker');
  vi.spyOn(L, 'marker');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(L.map).mockRestore();
  vi.mocked(L.circleMarker).mockRestore();
  vi.mocked(L.marker).mockRestore();
});

function renderMap(props: Partial<MapProps> = {}) {
  return render(<LeafletMap view={view} {...props} />);
}

const circles = () =>
  vi
    .mocked(L.circleMarker)
    .mock.results.map(({ value }) => value as L.CircleMarker);
const clusters = () =>
  vi
    .mocked(L.marker)
    .mock.results.map(({ value }) => value as L.Marker)
    .filter(marker => marker.options.title);

describe('<LeafletMap />', () => {
  it('shows OpenStreetMap tiles one zoom level deeper than MapLibre', () => {
    const onLoad = vi.fn();
    const { container } = renderMap({ onLoad, 'aria-hidden': true });

    expect(map.getZoom()).toBe(6);
    expect(container.querySelector('.leaflet-control-scale')).not.toBeNull();
    expect(container.querySelector('.leaflet-control-zoom')).not.toBeNull();
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    expect(onLoad).toHaveBeenCalledWith(
      { latitude: 50, longitude: 10, zoom: 5 },
      expect.objectContaining({
        northEast: expect.objectContaining({ lat: expect.any(Number) }),
      }),
    );
  });

  it('keeps world bounds and a minimum zoom in MapLibre levels', () => {
    renderMap({ worldBounds: true, minZoom: 1, scrollZoom: false });
    expect(map.getMinZoom()).toBe(2);
    expect(map.options.maxBounds).toBeDefined();
    expect(map.scrollWheelZoom.enabled()).toBe(false);
  });

  it('reports moves, drags and clicks to the latest handlers', () => {
    const onMoveStart = vi.fn();
    const onMove = vi.fn();
    const onMoveEnd = vi.fn();
    const onClick = vi.fn();
    const { rerender } = renderMap();
    rerender(
      <LeafletMap
        view={view}
        onMoveStart={onMoveStart}
        onMove={onMove}
        onMoveEnd={onMoveEnd}
        onClick={onClick}
      />,
    );

    act(() => {
      map.fire('movestart');
      map.fire('move');
      map.fire('moveend');
      map.fire('dragstart');
      map.fire('moveend');
    });
    act(() => {
      map.fire('click', {
        latlng: L.latLng(49, 9),
        originalEvent: { target: map.getContainer() },
      });
      map.fire('click', {
        latlng: L.latLng(49, 9),
        originalEvent: { target: document.createElement('div') },
      });
    });
    const popup = document.createElement('div');
    popup.className = 'leaflet-popup';
    act(() => {
      map.fire('click', {
        latlng: L.latLng(48, 8),
        originalEvent: { target: popup },
      });
    });

    expect(onMoveStart).toHaveBeenCalled();
    expect(onMove).toHaveBeenCalledWith(
      expect.objectContaining({ zoom: 5 }),
      expect.anything(),
    );
    expect(onMoveEnd.mock.calls.map(([, , dragged]) => dragged)).toEqual([
      false,
      true,
    ]);
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(onClick).toHaveBeenCalledWith([49, 9]);
  });

  it('moves only when it receives a new view, and through its handle', () => {
    const ref = createRef<MapHandle>();
    const { rerender } = renderMap({ ref });
    rerender(<LeafletMap ref={ref} view={view} />);
    expect(map.getCenter()).toEqual(L.latLng(50, 10));

    rerender(
      <LeafletMap ref={ref} view={{ latitude: 1, longitude: 2, zoom: 3 }} />,
    );
    expect(map.getCenter()).toEqual(L.latLng(1, 2));
    expect(map.getZoom()).toBe(4);

    act(() =>
      ref.current!.flyTo({ latitude: 5, longitude: 6, zoom: 7 }, false),
    );
    expect(map.getCenter()).toEqual(L.latLng(5, 6));
    expect(map.getZoom()).toBe(8);

    act(() =>
      ref.current!.fitBounds(
        { northEast: { lat: 11, lng: 11 }, southWest: { lat: 10, lng: 10 } },
        { padding: 10, maxZoom: 3, animate: false },
      ),
    );
    expect(map.getZoom()).toBe(4);
    act(() =>
      ref.current!.fitBounds(
        {
          northEast: { lat: 10.01, lng: 10.01 },
          southWest: { lat: 10, lng: 10 },
        },
        { padding: 10, animate: false },
      ),
    );
    expect(map.getZoom()).toBeGreaterThan(10);
  });

  it('clusters nearby points and expands them on click', async () => {
    const onClusterClick = vi.fn();
    const onPointClick = vi.fn();
    renderMap({ layers: [offers], onClusterClick, onPointClick });

    expect(clusters()).toHaveLength(1);
    expect(clusters()[0].options.title).toBe('2');
    expect(circles().map(circle => circle.options.fillColor)).toEqual([
      '#f2ae43',
    ]);

    act(() => {
      clusters()[0].fire('click');
    });
    const [layerId, cluster] = onClusterClick.mock.calls[0];
    expect(layerId).toBe('offers');
    expect(cluster.latitude).toBeCloseTo(50);
    expect(cluster.longitude).toBeCloseTo(10);
    await expect(cluster.expansionZoom()).resolves.toBeGreaterThan(12);
    await expect(cluster.leaves()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 1 }),
        expect.objectContaining({ id: 2 }),
      ]),
    );

    act(() => {
      circles()[0].fire('click');
    });
    expect(onPointClick).toHaveBeenCalledWith('offers', offers.points[2]);
  });

  it('shows point state and hides layers below their minimum zoom', () => {
    const ref = createRef<MapHandle>();
    const { rerender } = renderMap({ ref, layers: [offers] });

    act(() => ref.current!.setPointState('offers', 3, { selected: true }));
    expect(circles()[0].options).toMatchObject({ fillColor: '#000' });
    act(() =>
      ref.current!.setPointState('offers', 3, {
        selected: false,
        viewed: true,
      }),
    );
    expect(circles()[0].options).toMatchObject({
      fillColor: '#f2ae43',
      fillOpacity: 0.7,
    });
    act(() => ref.current!.setPointState('offers', 99, { selected: true }));

    vi.mocked(L.circleMarker).mockClear();
    rerender(
      <LeafletMap
        ref={ref}
        view={{ latitude: 50, longitude: 10, zoom: 1 }}
        layers={[offers]}
      />,
    );
    expect(circles()).toHaveLength(0);
  });

  it('accepts point and cluster clicks without handlers', () => {
    renderMap({ layers: [offers] });
    act(() => {
      clusters()[0].fire('click');
      circles()[0].fire('click');
    });
  });

  it('shows an approximate area as a dot, then a circle when zoomed in', () => {
    const area = { latitude: 50, longitude: 10, colour: '#5cb85c' };
    const { rerender } = renderMap({ area });
    expect(circles()[0].options).toMatchObject({ fillColor: '#5cb85c' });

    vi.spyOn(L, 'circle');
    rerender(
      <LeafletMap
        view={{ latitude: 50, longitude: 10, zoom: 11 }}
        area={area}
      />,
    );
    expect(L.circle).toHaveBeenCalledWith(
      [50, 10],
      expect.objectContaining({ radius: 1000 }),
    );
    rerender(<LeafletMap view={{ latitude: 50, longitude: 10, zoom: 11 }} />);
    vi.mocked(L.circle).mockRestore();
  });

  it('renders pins and a popup as React content', () => {
    const { rerender } = renderMap({
      pins: [
        {
          key: 'a',
          latitude: 50,
          longitude: 10,
          children: <button>Pin A</button>,
        },
        {
          key: 'b',
          latitude: 51,
          longitude: 11,
          children: <button>Pin B</button>,
        },
      ],
      popup: { key: 'a', latitude: 50, longitude: 10, children: 'Popup A' },
      children: 'Child',
    });

    expect(screen.getByRole('button', { name: 'Pin A' })).toBeInTheDocument();
    expect(
      screen.getByText('Popup A').closest('.leaflet-popup'),
    ).not.toBeNull();
    expect(screen.getByText('Child')).toBeInTheDocument();

    rerender(
      <LeafletMap
        view={view}
        pins={[
          {
            key: 'b',
            latitude: 52,
            longitude: 12,
            children: <button>Pin B</button>,
          },
        ]}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Pin A' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Popup A')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pin B' })).toBeInTheDocument();
  });

  it('resizes with its container and cleans up on unmount', () => {
    const { unmount } = renderMap();
    const invalidateSize = vi.spyOn(map, 'invalidateSize');
    resize();
    expect(invalidateSize).toHaveBeenCalledWith({ pan: false });
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
