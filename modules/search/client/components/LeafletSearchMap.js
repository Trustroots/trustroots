// External dependencies
import L from 'leaflet';
import PropTypes from 'prop-types';
import React, { useEffect, useRef } from 'react';
import Supercluster from 'supercluster';

import './leaflet-search-map.less';

// Internal dependencies
import { addRasterMapTiles } from '@/modules/core/client/utils/map';
import { CLUSTER_MAX_ZOOM, MIN_ZOOM } from './constants';

const offerColours = {
  'host-maybe': '#f2ae43',
  'host-yes': '#58ba58',
  'meet-yes': '#11b4da',
};

function getMapState(map) {
  const bounds = map.getBounds();
  const centre = map.getCenter();

  return {
    bounds: {
      northEast: bounds.getNorthEast(),
      southWest: bounds.getSouthWest(),
    },
    latitude: centre.lat,
    longitude: centre.lng,
    zoom: map.getZoom(),
  };
}

function createClusterIndex(data, maxZoom) {
  return new Supercluster({
    maxZoom,
    minPoints: 3,
    radius: 50,
  }).load(data.features);
}

function stopMapClick(event) {
  if (event?.originalEvent) {
    L.DomEvent.stopPropagation(event.originalEvent);
  }
}

function clusterIcon(count, colour) {
  return L.divIcon({
    className: 'leaflet-search-cluster',
    html: `<span style="background:${colour}">${count}</span>`,
    iconAnchor: [25, 25],
    iconSize: [50, 50],
  });
}

function addClusteredMarkers({
  colour,
  group,
  index,
  map,
  onPointClick,
  pointColour,
  viewport,
}) {
  group.clearLayers();

  if (viewport.zoom <= MIN_ZOOM) {
    return;
  }

  const bounds = map.getBounds();
  const points = index.getClusters(
    [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
    Math.floor(viewport.zoom),
  );

  points.forEach(point => {
    const [longitude, latitude] = point.geometry.coordinates;

    if (point.properties.cluster) {
      const marker = L.marker([latitude, longitude], {
        bubblingMouseEvents: false,
        icon: clusterIcon(point.properties.point_count_abbreviated, colour),
        keyboard: true,
        title: `${point.properties.point_count} results`,
      });

      marker.on('click', event => {
        stopMapClick(event);
        map.setView(
          [latitude, longitude],
          Math.min(
            index.getClusterExpansionZoom(point.properties.cluster_id),
            CLUSTER_MAX_ZOOM,
          ),
        );
      });
      group.addLayer(marker);
      return;
    }

    const marker = L.circleMarker([latitude, longitude], {
      bubblingMouseEvents: false,
      color: '#fff',
      fillColor: pointColour(point),
      fillOpacity: 1,
      radius: 10,
      weight: 2,
    });
    marker.on('click', event => {
      stopMapClick(event);
      onPointClick(point);
    });
    group.addLayer(marker);
  });
}

/**
 * Search-map renderer used where a WebGL map cannot be created.
 */
export default function LeafletSearchMap({
  bounds,
  communityNotes,
  offers,
  onCommunityNoteClick,
  onMapChange,
  onMapClick,
  onOfferClick,
  viewport,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const groupsRef = useRef(null);
  const callbacksRef = useRef({
    onCommunityNoteClick,
    onMapChange,
    onMapClick,
    onOfferClick,
  });

  useEffect(() => {
    callbacksRef.current = {
      onCommunityNoteClick,
      onMapChange,
      onMapClick,
      onOfferClick,
    };
  }, [onCommunityNoteClick, onMapChange, onMapClick, onOfferClick]);

  useEffect(() => {
    const map = L.map(containerRef.current, {
      zoomControl: true,
    }).setView([viewport.latitude, viewport.longitude], viewport.zoom);
    const offerGroup = L.layerGroup().addTo(map);
    const communityNoteGroup = L.layerGroup().addTo(map);

    addRasterMapTiles({ map, tileLayer: L.tileLayer });

    const onMoveEnd = () => callbacksRef.current.onMapChange(getMapState(map));
    map.on('click', () => callbacksRef.current.onMapClick());
    map.on('moveend', onMoveEnd);
    mapRef.current = map;
    groupsRef.current = { communityNoteGroup, offerGroup };
    onMoveEnd();

    // The search pane changes size after the mobile controls are laid out.
    // Leaflet otherwise keeps the narrow initial viewport and leaves unfilled
    // space beside the requested tiles on iOS.
    const invalidateSize = () => map.invalidateSize({ pan: false });
    const initialResize = window.setTimeout(invalidateSize);
    const settledResize = window.setTimeout(invalidateSize, 250);
    window.addEventListener('resize', invalidateSize);

    return () => {
      window.clearTimeout(initialResize);
      window.clearTimeout(settledResize);
      window.removeEventListener('resize', invalidateSize);
      map.remove();
      groupsRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    /* istanbul ignore next -- the map ref is initialised by the preceding mount effect */
    if (!map) {
      return;
    }

    // A selected place owns the camera until its bounds are cleared. Without
    // this guard, a render carrying the old persisted viewport can undo
    // fitBounds before Leaflet's moveend publishes the fitted viewport.
    if (bounds?.northEast && bounds?.southWest) {
      return;
    }

    const centre = map.getCenter();
    if (
      centre.lat !== viewport.latitude ||
      centre.lng !== viewport.longitude ||
      map.getZoom() !== viewport.zoom
    ) {
      map.setView([viewport.latitude, viewport.longitude], viewport.zoom);
    }
  }, [bounds, viewport]);

  // Leaflet needs to fit external search bounds itself. Deriving a viewport
  // through the WebGL map utility leaves the raster map with stale dimensions
  // after the mobile place-search panel has closed.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !bounds?.northEast || !bounds?.southWest) {
      return;
    }

    const fitSelectedBounds = () => {
      map.invalidateSize({ pan: false });
      map.fitBounds(
        [
          [bounds.southWest.lat, bounds.southWest.lng],
          [bounds.northEast.lat, bounds.northEast.lng],
        ],
        { padding: [40, 40] },
      );
    };

    const container = containerRef.current;

    // Fit immediately, then again after Angular has hidden the mobile place
    // panel and the map container has completed its layout transition.
    fitSelectedBounds();
    const nextLayoutFit = window.setTimeout(fitSelectedBounds);
    const settledLayoutFit = window.setTimeout(fitSelectedBounds, 250);

    const cancelDeferredFits = () => {
      window.clearTimeout(nextLayoutFit);
      window.clearTimeout(settledLayoutFit);
    };

    // Once someone starts moving or zooming the map, their camera choice wins
    // over the delayed mobile-layout correction below.
    container.addEventListener('pointerdown', cancelDeferredFits);
    container.addEventListener('touchstart', cancelDeferredFits);
    container.addEventListener('wheel', cancelDeferredFits);

    return () => {
      cancelDeferredFits();
      container.removeEventListener('pointerdown', cancelDeferredFits);
      container.removeEventListener('touchstart', cancelDeferredFits);
      container.removeEventListener('wheel', cancelDeferredFits);
    };
  }, [bounds]);

  useEffect(() => {
    const map = mapRef.current;
    const groups = groupsRef.current;
    /* istanbul ignore next -- both refs are initialised by the preceding mount effect */
    if (!map || !groups) {
      return;
    }

    const offerIndex = createClusterIndex(offers, CLUSTER_MAX_ZOOM);
    addClusteredMarkers({
      colour: 'rgba(18, 181, 145, 0.8)',
      group: groups.offerGroup,
      index: offerIndex,
      map,
      onPointClick: point =>
        callbacksRef.current.onOfferClick(point.properties.id),
      pointColour: point => offerColours[point.properties.offer] || '#ccc',
      viewport,
    });

    const communityNoteIndex = createClusterIndex(communityNotes, 14);
    addClusteredMarkers({
      colour: 'rgba(25, 118, 210, 0.8)',
      group: groups.communityNoteGroup,
      index: communityNoteIndex,
      map,
      onPointClick: point => callbacksRef.current.onCommunityNoteClick(point),
      pointColour: () => '#1565C0',
      viewport,
    });
  }, [communityNotes, offers, viewport]);

  return (
    <div
      className="search-map leaflet-search-map"
      data-testid="leaflet-search-map"
      ref={containerRef}
    />
  );
}

LeafletSearchMap.propTypes = {
  bounds: PropTypes.shape({
    northEast: PropTypes.shape({
      lat: PropTypes.number.isRequired,
      lng: PropTypes.number.isRequired,
    }).isRequired,
    southWest: PropTypes.shape({
      lat: PropTypes.number.isRequired,
      lng: PropTypes.number.isRequired,
    }).isRequired,
  }),
  communityNotes: PropTypes.shape({
    features: PropTypes.array.isRequired,
  }).isRequired,
  offers: PropTypes.shape({
    features: PropTypes.array.isRequired,
  }).isRequired,
  onCommunityNoteClick: PropTypes.func.isRequired,
  onMapChange: PropTypes.func.isRequired,
  onMapClick: PropTypes.func.isRequired,
  onOfferClick: PropTypes.func.isRequired,
  viewport: PropTypes.shape({
    latitude: PropTypes.number.isRequired,
    longitude: PropTypes.number.isRequired,
    zoom: PropTypes.number.isRequired,
  }).isRequired,
};
