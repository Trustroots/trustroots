import { TileLayer } from 'react-leaflet';
import React from 'react';
import { get } from 'lodash';

/**
 * Configures Trustroots map layers
 */
export default function MapLayers() {
  let tileUrl;
  let tileAttribution;

  // Is Mapbox configuration available?
  const mapboxToken = get(window, ['settings', 'mapbox', 'publicKey']);

  if (mapboxToken) {
    // Other styles than `streets` are `outdoors` and `satellite` but we're not u sing them here yet.
    // Default to `streets-v11` if not configured
    const style = get(window, ['settings', 'mapbox', 'maps', 'streets', 'map'], 'streets-v11');

    // Default to `mapbox` if not configured but that works only with Mapbox' global public styles
    const user = get(window, ['settings', 'mapbox', 'maps', 'streets', 'user'], 'mapbox');

    tileUrl = `https://api.mapbox.com/styles/v1/${user}/${style}/tiles/256/{z}/{x}/{y}?access_token=${mapboxToken}`;
    tileAttribution = '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a>';
  // Fall back to OSM
  } else {
    tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    tileAttribution = '© <a href="http://osm.org/copyright">OpenStreetMap</a> contributors';
  }
  return (
    <TileLayer attribution={tileAttribution} url={tileUrl} />
  );
}

MapLayers.propTypes = {};
