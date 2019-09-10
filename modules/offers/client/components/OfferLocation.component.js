// External dependencies
import { SVGOverlay } from 'react-map-gl';
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import Map from '@/modules/core/client/components/Map';

/*
  <Marker latitude={location[0]} longitude={location[1]}>
    {status.status}
  </Marker>
<path
  cx={cx}
  cy={cy}

  stroke="#989898"
  strokeOpacity="1"
  strokeWidth="2"
  strokeLinecap="round"
  strokeLinejoin="round"
  fill="#b1b1b1"
  fillOpacity="0.5"
  fillRule="evenodd"
  d="M862.571317711845,380.16179131902754a337,337 0 1,0 674,0 a337,337 0 1,0 -674,0 "
></path>
<circle id="e1_circle" cx="206" cy="344"  r="68.6002915446"></circle>
  */
export default function OfferLocation({ location }) {
  return (
    location &&
    location.length === 2 && (
      <Map
        className="offer-location"
        height={320}
        location={location}
        width="100%"
      >
        <SVGOverlay
          redraw={({ project }) => {
            // Longitude, latitude are in different order for projection than in our data source
            const [cx, cy] = project([location[1], location[0]]);
            return (
              <circle
                cx={cx}
                cy={cy}
                r={50}
                style={{
                  fill: '#b1b1b1',
                  fillOpacity: '0.5',
                  stroke: '#989898',
                  strokeWidth: '2px',
                }}
              />
            );
          }}
        />
      </Map>
    )
  );
}

OfferLocation.propTypes = {
  location: PropTypes.arrayOf(PropTypes.number).isRequired,
};
