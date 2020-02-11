import { TileLayer } from 'react-leaflet';
import React from 'react';
import get from 'lodash/get';

/**
 * Configures Trustroots map layers
 */
export default function MapLayers() {
  let tileUrl;
  let tileAttribution;

  // Is Mapbox configuration available?
  const mapboxConfig = get(window, ['settings', 'mapbox'], {});

  if (mapboxConfig.publicKey) {
    // Other styles than `streets` are `outdoors` and `satellite` but we're not u sing them here yet.
    // Default to `streets-v11` if not configured
    const style = get(mapboxConfig, ['maps', 'streets', 'map'], 'streets-v11');

    // Default to `mapbox` if not configured but that works only with Mapbox' global public styles
    const user = get(mapboxConfig, ['maps', 'streets', 'user'], 'mapbox');

    tileUrl = `https://api.mapbox.com/styles/v1/${user}/${style}/tiles/256/{z}/{x}/{y}?access_token=${mapboxConfig.publicKey}`;
    tileAttribution =
      '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a>';
    // Fall back to OSM
  } else {
    tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    tileAttribution =
      '© <a href="http://osm.org/copyright">OpenStreetMap</a> contributors';
  }
  return <TileLayer attribution={tileAttribution} url={tileUrl} />;
}

MapLayers.propTypes = {};
