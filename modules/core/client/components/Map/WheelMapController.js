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
}
