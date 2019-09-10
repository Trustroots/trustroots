// External dependencies
import '@/node_modules/mapbox-gl/dist/mapbox-gl.css';
// import { NavigationControl, ScaleControl } from 'react-map-gl';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import ReactMapGL, { NavigationControl, ScaleControl } from 'react-map-gl';

export default function Map(props) {
  const publicKey = window?.settings?.mapbox?.publicKey;
  const {
    children,
    className,
    location = [48.6908333333, 9.14055555556], // Default location to Europe when not set
    zoom = 6,
  } = props;

  const [viewport, setViewport] = useState({
    latitude: location[0],
    longitude: location[1],
    zoom,
  });

  if (!publicKey) {
    // Internal development message, no need to translate.
    return (
      <div className={className}>
        You must configure Mapbox <code>publicKey</code> for maps to work.
      </div>
    );
  }

  return (
    <ReactMapGL
      dragRotate={false}
      height={320}
      mapboxApiAccessToken={publicKey}
      onViewportChange={setViewport}
      touchRotate={false}
      width={320}
      {...props}
      {...viewport}
    >
      <div style={{ position: 'absolute', top: 10, right: 10 }}>
        <NavigationControl showCompass={false} />
      </div>
      <div style={{ position: 'absolute', bottom: 10, right: 50 }}>
        <ScaleControl />
      </div>
      {children}
    </ReactMapGL>
  );
}

Map.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  location: PropTypes.arrayOf(PropTypes.number),
  zoom: PropTypes.number,
};
