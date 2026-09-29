import { MapController } from 'react-map-gl';

/**
 * React Map GL normalises pixel and line wheel input, but leaves page units
 * unscaled. Treat a page as the map's height so a wheel turn visibly zooms.
 */
export default class WheelMapController extends MapController {
  handleEvent(event) {
    if (event.type === 'wheel' && event.srcEvent.deltaMode === 2) {
      return super.handleEvent({
        ...event,
        delta: event.delta * this.mapStateProps.height,
      });
    }

    return super.handleEvent(event);
  }

  updateViewport(newMapState, transition, interactionState) {
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
      this._setInteractionState({ isPanning: false, isZooming: false });
    }
  }
}
