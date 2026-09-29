// External dependencies
import { BaseControl, SVGOverlay } from 'react-map-gl';
import React from 'react';
import type { MapControlProps } from 'react-map-gl/src/components/use-map-control';

// Internal dependencies
import { getOfferHexColor, zoomToPixelMeters } from '../utils/markers.js';

// ReactMapGL custom overlay
// https://uber.github.io/react-map-gl/docs/advanced/custom-overlays
interface OfferLocationOverlayProps extends MapControlProps {
  location: [number, number];
  offerStatus?: string;
  offerType?: string;
}

interface ViewportContext {
  viewport: { zoom: number };
}

interface SVGOverlayProps {
  ref: React.RefObject<HTMLElement | SVGAElement | null>;
  redraw: (context: {
    project: (coordinates: [number, number]) => [number, number];
  }) => React.ReactElement;
}

const TypedSVGOverlay = SVGOverlay as unknown as React.ComponentType<SVGOverlayProps>;

class OfferLocationOverlay extends BaseControl<
  OfferLocationOverlayProps,
  SVGSVGElement
> {
  // Instead of implementing render(), implement _render()
  _render() {
    const { viewport } = this._context as ViewportContext;
    const { location, offerType, offerStatus } = this.props;

    // _containerRef registers event listeners for map interactions
    // @TODO: performance? Re-render using requestAnimationFrame? https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame
    return (
      <TypedSVGOverlay
        ref={this._containerRef}
        redraw={({ project }) => {
          const [latitude, longitude] = location;

          // Note different order of longitude and latitude in the array compared to `location`
          const [cx, cy] = project([longitude, latitude]);

          // Zoom threshold when marker changes between "high level dot" vs "detailed area bubble"
          const zoomThreshold = 11;

          // Calculate circle size based on zoom level
          const circleRadius =
            viewport.zoom >= zoomThreshold
              ? zoomToPixelMeters({
                  latitude,
                  meters: 1000,
                  zoom: viewport.zoom,
                })
              : 12;

          // When zoomed closer, show area bubble. Otherwise standard offer dot.
          const circleStyle =
            viewport.zoom >= zoomThreshold
              ? {
                  fill: '#b1b1b1',
                  fillOpacity: '0.5',
                  stroke: '#989898',
                  strokeWidth: '2px',
                }
              : {
                  fill: getOfferHexColor({ offerType, offerStatus }),
                };

          return (
            <circle cx={cx} cy={cy} r={circleRadius} style={circleStyle} />
          );
        }}
      />
    );
  }
}

export default OfferLocationOverlay;
