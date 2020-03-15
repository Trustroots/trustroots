// External dependencies
import { BaseControl, SVGOverlay } from 'react-map-gl';
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import { getOfferHexColor, zoomToPixelMeters } from '../utils/markers.js';

// ReactMapGL custom overlay
// https://uber.github.io/react-map-gl/docs/advanced/custom-overlays
class OfferLocationOverlay extends BaseControl {
  // Instead of implementing render(), implement _render()
  _render() {
    const { viewport } = this._context;
    const { location, offerType, offerStatus } = this.props;

    // _containerRef registers event listeners for map interactions
    // @TODO: performance? Re-render using requestAnimationFrame? https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame
    return (
      <SVGOverlay
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

OfferLocationOverlay.propTypes = {
  location: PropTypes.arrayOf(PropTypes.number).isRequired,
  offerStatus: PropTypes.string,
  offerType: PropTypes.string,
};

export default OfferLocationOverlay;
