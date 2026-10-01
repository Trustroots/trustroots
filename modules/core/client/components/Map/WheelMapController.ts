import { MapController, type MjolnirEvent } from 'react-map-gl';

/**
 * React Map GL normalises pixel and line wheel input, but leaves page units
 * unscaled. Treat a page as the map's height so a wheel turn visibly zooms.
 */
export default class WheelMapController extends MapController {
  handleEvent(event: MjolnirEvent): boolean {
    if (
      event.type === 'wheel' &&
      (event.srcEvent as WheelEvent).deltaMode === 2
    ) {
      return super.handleEvent({
        ...event,
        delta: (event.delta as number) * this.mapStateProps.height,
      });
    }

    return super.handleEvent(event);
  }

  updateViewport(...args: Parameters<MapController['updateViewport']>): void {
    const [newMapState, transition, interactionState] = args;
    // The default wheel handler schedules a 1 ms transition even with
    // smoothing disabled. Its initial frame restores the previous viewport
    // and can overwrite a controlled React update. Apply that zoom directly.
    const immediateWheelZoom = transition?.transitionDuration === 1;
    const nextTransition = immediateWheelZoom
      ? { ...transition, transitionDuration: 0 }
      : transition;
    super.updateViewport(newMapState, nextTransition, interactionState);

    if (immediateWheelZoom) {
      // Complete the interaction without waiting for an animation to end.
      const controller = this as unknown as {
        _setInteractionState: (state: {
          isPanning: boolean;
          isZooming: boolean;
        }) => void;
      };
      controller._setInteractionState({ isPanning: false, isZooming: false });
    }
  }
}
