import { EventManager } from 'mjolnir.js';
import { Manager } from 'mjolnir.js/dist/es5/utils/hammer.browser';
import ReactMapGL, { WebMercatorViewport } from 'react-map-gl';
import WheelMapController from '@/modules/core/client/components/Map/WheelMapController';

describe('map wheel zoom', () => {
  let element;
  let eventManager;
  let viewport;
  let interactionState;

  function createMap({
    scrollZoom = true,
    zoom = 6,
    applyTransitions = false,
  } = {}) {
    element = document.createElement('div');
    // The Node entry point uses a no-op gesture manager. Use the browser
    // implementation so wheel events reach the real map controller.
    eventManager = new EventManager(element, { Manager });
    const controller = new WheelMapController();
    viewport = {
      width: 640,
      height: 320,
      latitude: 10,
      longitude: 20,
      zoom,
    };

    function onViewportChange(nextViewport) {
      // Apply controlled viewport updates synchronously; browser tests cover
      // the rendered transition and the application's persistence debounce.
      viewport = applyTransitions
        ? nextViewport
        : { ...nextViewport, transitionDuration: 0 };
      controller.setOptions({
        ...ReactMapGL.defaultProps,
        ...viewport,
        eventManager,
        onViewportChange,
        onStateChange,
        scrollZoom,
      });
    }

    function onStateChange(nextState) {
      interactionState = { ...nextState };
    }

    controller.setOptions({
      ...ReactMapGL.defaultProps,
      ...viewport,
      eventManager,
      onViewportChange,
      onStateChange,
      scrollZoom,
    });
  }

  function wheel(deltaMode, deltaY, extra = {}) {
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
  ])(
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
