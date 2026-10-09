import { EventManager, type EventManagerOptions } from 'mjolnir.js';
import { Manager } from 'mjolnir.js/dist/es5/utils/hammer.browser';
import ReactMapGL, {
  WebMercatorViewport,
  type ViewportProps,
} from 'react-map-gl';
import WheelMapController from '@/modules/core/client/components/Map/WheelMapController';

type TestViewport = ViewportProps &
  Required<
    Pick<ViewportProps, 'width' | 'height' | 'latitude' | 'longitude' | 'zoom'>
  >;
type InteractionState = { isZooming: boolean; isPanning: boolean };
type CreateMapOptions = {
  scrollZoom?: boolean | { smooth: boolean };
  zoom?: number;
  applyTransitions?: boolean;
};

// react-map-gl exposes these defaults at runtime, but its function component
// declaration does not include the legacy static property.
const mapDefaultProps = (
  ReactMapGL as typeof ReactMapGL & { defaultProps: Partial<ViewportProps> }
).defaultProps;

describe('map wheel zoom', () => {
  let element: HTMLDivElement;
  let eventManager: EventManager;
  let viewport: TestViewport;
  let interactionState: InteractionState;

  function createMap({
    scrollZoom = true,
    zoom = 6,
    applyTransitions = false,
  }: CreateMapOptions = {}) {
    element = document.createElement('div');
    // The Node entry point uses a no-op gesture manager. Use the browser
    // implementation so wheel events reach the real map controller.
    // The browser Hammer implementation and mjolnir's bundled Hammer types
    // differ across package entry points; runtime constructor is compatible.
    eventManager = new EventManager(element, {
      Manager: Manager as unknown as EventManagerOptions['Manager'],
    });
    const controller = new WheelMapController();
    viewport = {
      width: 640,
      height: 320,
      latitude: 10,
      longitude: 20,
      zoom,
    };

    function onViewportChange(nextViewport: TestViewport) {
      // Apply controlled viewport updates synchronously; browser tests cover
      // the rendered transition and the application's persistence debounce.
      viewport = applyTransitions
        ? nextViewport
        : { ...nextViewport, transitionDuration: 0 };
      controller.setOptions({
        ...mapDefaultProps,
        ...viewport,
        eventManager,
        onViewportChange,
        onStateChange,
        scrollZoom,
      });
    }

    function onStateChange(nextState: InteractionState) {
      interactionState = { ...nextState };
    }

    controller.setOptions({
      ...mapDefaultProps,
      ...viewport,
      eventManager,
      onViewportChange,
      onStateChange,
      scrollZoom,
    });
  }

  function wheel(
    deltaMode: number,
    deltaY: number,
    extra: WheelEventInit = {},
  ): WheelEvent {
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 480,
      clientY: 160,
      deltaMode,
      deltaY,
      ...extra,
    });
    element.dispatchEvent(event);
    return event;
  }

  afterEach(() => {
    eventManager.destroy();
    jest.useRealTimers();
  });

  it('immediately applies wheel zoom when smoothing is disabled', () => {
    jest.useFakeTimers();
    createMap({ applyTransitions: true });
    wheel(0, -120);
    expect(viewport.zoom).toBeGreaterThan(6.5);
    wheel(0, 120);
    expect(viewport.zoom).toBeCloseTo(6, 6);
    expect(interactionState.isZooming).toBe(false);
    expect(interactionState.isPanning).toBe(false);
  });

  it('retains explicitly requested smooth wheel zoom', () => {
    jest.useFakeTimers();
    createMap({ scrollZoom: { smooth: true }, applyTransitions: true });
    wheel(0, -120);
    expect(viewport.zoom).toBe(6);
    expect(interactionState.isZooming).toBe(true);
    jest.advanceTimersByTime(300);
    expect(viewport.zoom).toBeGreaterThan(6.5);
    expect(interactionState.isZooming).toBe(false);
  });

  it.each([
    ['pixel', 0, 120],
    ['line', 1, 3],
    ['page', 2, 1],
  ] as Array<[string, number, number]>)(
    'visibly zooms in and out with %s units around the pointer',
    (_, mode, delta) => {
      createMap();
      const pointerLocation = new WebMercatorViewport(viewport).unproject([
        480, 160,
      ]);

      expect(wheel(mode, -delta).defaultPrevented).toBe(true);
      const zoomedIn = viewport.zoom;
      expect(zoomedIn).toBeGreaterThan(6.5);
      const nextPointerLocation = new WebMercatorViewport(viewport).unproject([
        480, 160,
      ]);
      expect(nextPointerLocation[0]).toBeCloseTo(pointerLocation[0], 6);
      expect(nextPointerLocation[1]).toBeCloseTo(pointerLocation[1], 6);

      wheel(mode, delta);
      expect(viewport.zoom).toBeLessThan(zoomedIn - 0.5);
      expect(viewport.zoom).toBeCloseTo(6, 6);
    },
  );

  it('respects disabled wheel zoom', () => {
    createMap({ scrollZoom: false });
    expect(wheel(2, -1).defaultPrevented).toBe(false);
    expect(viewport.zoom).toBe(6);
  });

  it('retains precise Shift-wheel zoom and ignores zero movement', () => {
    createMap();
    wheel(2, -1, { shiftKey: true });
    expect(viewport.zoom).toBeGreaterThan(6.1);
    expect(viewport.zoom).toBeLessThan(6.5);
    const zoom = viewport.zoom;
    wheel(2, 0);
    expect(viewport.zoom).toBe(zoom);
  });

  it('respects the maximum zoom', () => {
    createMap({ zoom: 24 });
    wheel(2, -1);
    expect(viewport.zoom).toBe(24);
  });

  it('retains keyboard zoom', () => {
    createMap();
    element.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 187 }));
    expect(viewport.zoom).toBeGreaterThan(6);
  });
});
