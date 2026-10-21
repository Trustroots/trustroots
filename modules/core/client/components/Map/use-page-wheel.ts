import { useEffect, type RefObject } from 'react';

/** Mapbox normalises pixel and line wheel deltas, but not page units. */
export default function usePageWheel(
  surfaceRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!enabled || !surface) return;

    const normalisePageWheel = (event: WheelEvent) => {
      if (event.deltaMode !== 2) return;
      event.preventDefault();
      event.stopPropagation();
      event.target!.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaMode: 0,
          deltaX: event.deltaX * surface.clientWidth,
          deltaY: event.deltaY * surface.clientHeight,
          clientX: event.clientX,
          clientY: event.clientY,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
        }),
      );
    };

    surface.addEventListener('wheel', normalisePageWheel, {
      capture: true,
      passive: false,
    });
    return () => surface.removeEventListener('wheel', normalisePageWheel, true);
  }, [enabled, surfaceRef]);
}
