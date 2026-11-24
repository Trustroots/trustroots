import React, { createRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import type ReactMapGL from '@vis.gl/react-maplibre';

import MapLibreMap from '@/modules/core/client/components/Map/MapLibreMap';
import type {
  MapHandle,
  MapPointLayer,
  MapProps,
} from '@/modules/core/client/components/Map/types';

type GLProps = React.ComponentProps<typeof ReactMapGL>;
type GLEvent<Handler extends keyof GLProps> = Parameters<
  NonNullable<GLProps[Handler]>
>[0];

const mockSource = {
  getClusterExpansionZoom: vi.fn(),
  getClusterLeaves: vi.fn(),
};
const mockMap = {
  getCenter: () => ({ lat: 51, lng: 11 }),
  getZoom: vi.fn(() => 5),
  getBounds: () => ({
    getNorthEast: () => ({ lat: 52, lng: 12 }),
    getSouthWest: () => ({ lat: 50, lng: 10 }),
  }),
  jumpTo: vi.fn(),
  fitBounds: vi.fn(),
  flyTo: vi.fn(),
  setZoom: vi.fn(),
  setFeatureState: vi.fn(),
  getSource: vi.fn(() => mockSource),
  touchZoomRotate: { disableRotation: vi.fn() },
  scrollZoom: { setWheelZoomRate: vi.fn() },
};
let glProps!: GLProps;
const layerProps: Record<string, Record<string, unknown>> = {};
vi.mock('@vis.gl/react-maplibre', () => ({
  default: function MockReactMapGL(
    props: GLProps & { ref: React.Ref<unknown> },
  ) {
    glProps = props;
    React.useImperativeHandle(props.ref, () => ({ getMap: () => mockMap }));
    return <div data-testid="gl-map">{props.children}</div>;
  },
  Source: ({ children }: { children: React.ReactNode }) => children,
  Layer: (props: { id: string }) => {
    layerProps[props.id] = props;
    return null;
  },
  Marker: ({ children }: { children: React.ReactNode }) => (
    <div className="maplibregl-marker">{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
}));
vi.mock('maplibre-gl', () => ({ setWorkerUrl: vi.fn() }));
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?url', () => ({
  default: 'worker.js',
}));
vi.mock('@/modules/core/client/components/Map/MapNavigationControl', () => ({
  default: () => null,
}));
vi.mock('@/modules/core/client/components/Map/MapScaleControl', () => ({
  default: () => null,
}));

const view = { latitude: 51, longitude: 11, zoom: 5 };
const bounds = {
  northEast: { lat: 52, lng: 12 },
  southWest: { lat: 50, lng: 10 },
};
const offers: MapPointLayer = {
  id: 'offers',
  minZoom: 2,
  clusterMaxZoom: 12,
  clusterColour: '#0f0',
  clusterTextColour: '#111',
  points: [
    { id: 1, latitude: 50, longitude: 10, colour: '#58ba58', properties: {} },
  ],
};
const feature = (layerId: string, properties: Record<string, unknown>) => ({
  id: 7,
  source: layerId.replace(/-(points|clusters)$/, ''),
  layer: { id: layerId },
  geometry: { type: 'Point', coordinates: [10, 50] },
  properties,
});

function renderMap(props: Partial<MapProps> = {}) {
  return render(<MapLibreMap view={view} layers={[offers]} {...props} />);
}

function click(features: unknown[], target: Element = document.body) {
  act(() =>
    glProps.onClick!({
      features,
      lngLat: { lat: 49, lng: 9 },
      originalEvent: { target },
    } as unknown as GLEvent<'onClick'>),
  );
}

const target = { target: mockMap } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('<MapLibreMap />', () => {
  it('reports the loaded camera and disables rotation', () => {
    const onLoad = vi.fn();
    renderMap({ onLoad, worldBounds: true, minZoom: 1 });

    expect(glProps.mapStyle).toBe(
      'https://tiles.openfreemap.org/styles/liberty',
    );
    expect(glProps.maxBounds).toEqual([-180, -85, 180, 85]);
    expect(glProps.interactiveLayerIds).toEqual([
      'offers-clusters',
      'offers-points',
    ]);
    act(() => glProps.onLoad!(target));
    expect(mockMap.touchZoomRotate.disableRotation).toHaveBeenCalled();
    expect(mockMap.scrollZoom.setWheelZoomRate).toHaveBeenCalledWith(1 / 100);
    expect(onLoad).toHaveBeenCalledWith(view, bounds);
  });

  it('reports moves and whether a drag caused them', () => {
    const onMoveStart = vi.fn();
    const onMove = vi.fn();
    const onMoveEnd = vi.fn();
    const { container } = renderMap({ onMoveStart, onMove, onMoveEnd });

    act(() => glProps.onMoveStart!(target));
    act(() => glProps.onMove!(target));
    act(() => glProps.onMoveEnd!(target));
    act(() => glProps.onDragStart!(target));
    act(() => glProps.onMoveEnd!(target));
    act(() => glProps.onMoveEnd!(target));

    expect(container.firstChild).toHaveAttribute('data-map-latitude', '51');
    expect(container.firstChild).toHaveAttribute('data-map-zoom', '5');
    expect(onMoveStart).toHaveBeenCalled();
    expect(onMove).toHaveBeenCalledWith(view, bounds);
    expect(onMoveEnd.mock.calls.map(([, , dragged]) => dragged)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('moves only when it receives a new view', () => {
    const { rerender } = renderMap();
    rerender(<MapLibreMap view={view} />);
    expect(mockMap.jumpTo).not.toHaveBeenCalled();
    rerender(<MapLibreMap view={{ latitude: 1, longitude: 2, zoom: 3 }} />);
    expect(mockMap.jumpTo).toHaveBeenCalledWith({ center: [2, 1], zoom: 3 });
  });

  it('moves the camera and point state through its handle', () => {
    const ref = createRef<MapHandle>();
    renderMap({ ref });

    ref.current!.fitBounds(bounds, { padding: 40, animate: false });
    ref.current!.flyTo({ latitude: 1, longitude: 2, zoom: 3 });
    ref.current!.flyTo({ latitude: 1, longitude: 2, zoom: 3 }, false);
    ref.current!.setPointState('offers', 7, { selected: true });

    expect(mockMap.fitBounds).toHaveBeenCalledWith(
      [
        [10, 50],
        [12, 52],
      ],
      { padding: 40, animate: false },
    );
    expect(mockMap.flyTo).toHaveBeenCalledWith({
      center: [2, 1],
      zoom: 3,
      speed: 3,
      animate: true,
    });
    expect(mockMap.flyTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ animate: false }),
    );
    expect(mockMap.setFeatureState).toHaveBeenCalledWith(
      { source: 'offers', id: 7 },
      { selected: true },
    );
  });

  it('clicks points ahead of clusters drawn above them', () => {
    const onPointClick = vi.fn();
    const onClusterClick = vi.fn();
    renderMap({ onPointClick, onClusterClick });

    click([
      feature('community-notes-clusters', { cluster: true, cluster_id: 3 }),
      feature('offers-points', { id: 'offer-1', colour: '#58ba58' }),
    ]);

    expect(onClusterClick).not.toHaveBeenCalled();
    expect(onPointClick).toHaveBeenCalledWith('offers', {
      id: 7,
      latitude: 50,
      longitude: 10,
      colour: '#58ba58',
      properties: { id: 'offer-1', colour: '#58ba58' },
    });
  });

  it('expands clusters from their source', async () => {
    const onClusterClick = vi.fn();
    mockSource.getClusterExpansionZoom.mockResolvedValue(9);
    mockSource.getClusterLeaves.mockResolvedValue([
      feature('offers-points', { id: 'offer-1' }),
      { ...feature('offers-points', {}), properties: null },
    ]);
    renderMap({ onClusterClick });

    click([
      feature('offers-clusters', {
        cluster: true,
        cluster_id: 3,
        point_count: 2,
      }),
    ]);

    const [layerId, cluster] = onClusterClick.mock.calls[0];
    expect(layerId).toBe('offers');
    expect(cluster).toMatchObject({ latitude: 50, longitude: 10 });
    await expect(cluster.expansionZoom()).resolves.toBe(9);
    await expect(cluster.leaves()).resolves.toEqual([
      expect.objectContaining({ id: 7, properties: { id: 'offer-1' } }),
      expect.objectContaining({ properties: {} }),
    ]);
    expect(mockSource.getClusterLeaves).toHaveBeenCalledWith(3, 2, 0);
  });

  it('reports clicks on the map but not on its markers or popups', () => {
    const onClick = vi.fn();
    renderMap({
      onClick,
      pins: [{ key: 'pin', latitude: 50, longitude: 10, children: 'Pin' }],
    });

    click([], screen.getByText('Pin'));
    expect(onClick).not.toHaveBeenCalled();
    click([]);
    expect(onClick).toHaveBeenCalledWith([49, 9]);
  });

  it('accepts clicks without handlers', () => {
    renderMap();
    click(undefined as never);
    click([]);
    click([feature('offers-points', {})]);
    click([feature('offers-clusters', { cluster: true })]);
  });

  it('highlights the hovered point and clears it on leave', () => {
    renderMap();
    const point = feature('offers-points', {});

    act(() =>
      glProps.onMouseMove!({
        features: [feature('offers-clusters', {})],
      } as unknown as GLEvent<'onMouseMove'>),
    );
    expect(mockMap.setFeatureState).not.toHaveBeenCalled();
    act(() =>
      glProps.onMouseMove!({
        features: [point],
      } as unknown as GLEvent<'onMouseMove'>),
    );
    expect(mockMap.setFeatureState).toHaveBeenLastCalledWith(point, {
      hover: true,
    });
    act(() => glProps.onMouseLeave!({} as GLEvent<'onMouseLeave'>));
    expect(mockMap.setFeatureState).toHaveBeenLastCalledWith(point, {
      hover: false,
    });
    act(() => glProps.onMouseMove!({} as GLEvent<'onMouseMove'>));
    expect(mockMap.setFeatureState).toHaveBeenCalledTimes(2);
  });

  it('ignores missing-layer errors caused by style teardown', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    renderMap();

    glProps.onError!({
      error: new Error(
        "The layer 'offers-points' does not exist in the map's style and cannot be queried for features.",
      ),
    } as GLEvent<'onError'>);
    expect(consoleError).not.toHaveBeenCalled();
    const other = new Error('Map source failed');
    glProps.onError!({ error: other } as GLEvent<'onError'>);
    expect(consoleError).toHaveBeenCalledWith(other);
    glProps.onError!({} as GLEvent<'onError'>);
    expect(consoleError).toHaveBeenLastCalledWith(undefined);
    consoleError.mockRestore();
  });

  it('zooms the map on a Firefox trackpad pinch without zooming the page', () => {
    const { container, rerender } = renderMap();
    const surface = container.firstElementChild!;
    const wheel = (init: WheelEventInit) => {
      const event = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ...init,
      });
      act(() => screen.getByTestId('gl-map').dispatchEvent(event));
      return event;
    };

    expect(wheel({ deltaY: -50 }).defaultPrevented).toBe(false);
    expect(wheel({ ctrlKey: true, deltaY: -50 }).defaultPrevented).toBe(true);
    expect(mockMap.setZoom).toHaveBeenLastCalledWith(5.5);
    wheel({ ctrlKey: true, deltaMode: 1, deltaY: -1 });
    expect(mockMap.setZoom).toHaveBeenLastCalledWith(5.4);
    wheel({ ctrlKey: true, deltaY: -5000 });
    expect(mockMap.setZoom).toHaveBeenLastCalledWith(20);
    wheel({ ctrlKey: true, deltaY: 5000 });
    expect(mockMap.setZoom).toHaveBeenLastCalledWith(0);

    rerender(<MapLibreMap view={view} scrollZoom={false} />);
    expect(glProps.scrollZoom).toBe(false);
    expect(wheel({ ctrlKey: true, deltaY: -50 }).defaultPrevented).toBe(false);
    expect(surface).toHaveClass('tw:map-scale');
  });

  it('draws clustered points with a cluster count font from the style', () => {
    renderMap();
    expect(layerProps['offers-count'].layout).toEqual(
      expect.objectContaining({ 'text-font': ['Noto Sans Bold'] }),
    );
    expect(layerProps['offers-clusters'].minzoom).toBe(2);
  });

  it('shows an approximate area, pins and a popup', () => {
    renderMap({
      area: { latitude: 50, longitude: 10, colour: '#5cb85c' },
      popup: { key: 'popup', latitude: 50, longitude: 10, children: 'Popup' },
      children: 'Child',
      'aria-hidden': true,
    });

    expect(layerProps['area-circle'].minzoom).toBe(11);
    expect(layerProps['area-dot'].paint).toEqual({
      'circle-color': '#5cb85c',
      'circle-radius': 12,
    });
    expect(screen.getByRole('dialog', { hidden: true })).toHaveTextContent(
      'Popup',
    );
    expect(screen.getByText('Child')).toBeInTheDocument();
  });
});
