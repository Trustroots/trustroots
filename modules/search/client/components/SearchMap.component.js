// External dependencies
import { useDebouncedCallback } from 'use-debounce';
import PropTypes from 'prop-types';
import React, { createRef, useEffect, useState } from 'react';
import ReactMapGL, {
  FlyToInterpolator,
  Layer,
  Source,
  WebMercatorViewport,
} from 'react-map-gl';

// Internal dependencies
import { getMapBoxToken } from '@/modules/core/client/utils/map';
import {
  MAP_STYLE_DEFAULT,
  MAP_STYLE_OSM,
} from '@/modules/core/client/components/Map/constants';
import { MIN_ZOOM, SOURCE_OFFERS } from './constants';
import { DEFAULT_LOCATION } from '@/modules/core/client/utils/constants';
import MapNavigationControl from '@/modules/core/client/components/Map/MapNavigationControl';
import MapScaleControl from '@/modules/core/client/components/Map/MapScaleControl';
import MapStyleControl from '@/modules/core/client/components/Map/MapStyleControl';
import SearchMapNoContent from './SearchMapNoContent';
import { ensureValidLat, ensureValidLng } from '../utils';
import {
  clusterCountLayerMapbox,
  clusterCountLayerOSM,
  clusterLayer,
  unclusteredPointLayer,
} from './layers';
import { getOffer, queryOffers } from '@/modules/offers/client/api/offers.api';
import usePersistentMapStyle from '../hooks/use-persistent-map-style';
import usePersistentMapLocation from '../hooks/use-persistent-map-location';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function SearchMap(props) {
  const {
    filters,
    location,
    locationBounds: bounds,
    onOfferClose,
    onOfferOpen,
  } = props;

  const [
    persistentMapLocation,
    setPersistentMapLocation,
  ] = usePersistentMapLocation({
    latitude: DEFAULT_LOCATION.lat,
    longitude: DEFAULT_LOCATION.lng,
    zoom: DEFAULT_LOCATION.zoom,
  });

  const [viewport, setViewport] = useState(persistentMapLocation);
  const [mapStyle, setMapstyle] = usePersistentMapStyle(MAP_STYLE_DEFAULT);
  const [map, setMap] = useState();
  const [hoveredOffer, setHoveredOffer] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(false);
  const [offers, setOffers] = useState({
    features: [],
    type: 'FeatureCollection',
  });
  const MAPBOX_TOKEN = getMapBoxToken();
  // If no mapbox token, and we're in production, don't show the style switcher
  const showMapStyles = !!MAPBOX_TOKEN || process.env.NODE_ENV !== 'production';
  const sourceRef = createRef();
  const mapRef = createRef();

  // Get the Mapbox object for direct manipulation
  const getMapRef = () => {
    if (map) {
      // console.log('map ref from cache'); //eslint-disable-line
      return map;
    }

    // console.time('TIME - getMapRef'); //eslint-disable-line
    const mapFromRef = mapRef?.current?.getMap();
    if (!mapFromRef) {
      console.log('🛑No map from ref available!'); //eslint-disable-line
      return;
    }
    // console.timeEnd('TIME - getMapRef'); //eslint-disable-line
    return mapFromRef;
  };

  /**
   * @param  {[type]} bounds Bounding box coordinates with shape:
   *   northEast.lat;
   *   northEast.lng;
   *   southWest.lat;
   *   southWest.lng;
   */
  const zoomToBounds = ({ northEast, southWest }) => {
    console.log('zoomToBounds'); //eslint-disable-line
    const newViewport = new WebMercatorViewport(viewport);
    const { longitude, latitude, zoom } = newViewport.fitBounds(
      [
        // [minLng, minLat],
        // [maxLng, maxLat],
        [northEast.lng, northEast.lat],
        [southWest.lng, southWest.lat],
      ],
      {
        padding: 40,
      },
    );

    setViewport({
      ...viewport,
      longitude,
      latitude,
      zoom,
    });
  };

  /**
   * Hook on map interactions to update features
   */
  const updateOffers = () => {
    // Don't fetch if viewing the whole world
    if (viewport.zoom <= MIN_ZOOM) {
      return;
    }

    const map = getMapRef();
    // https://docs.mapbox.com/mapbox-gl-js/api/geography/#lnglatbounds
    const bounds = map.getBounds();
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();
    const zoom = map.getZoom();

    // Expand bounding box depending on the zoom level slightly to load more offers over the edge of the viewport
    const boundsBuffer = 10 / zoom;
    // Latitudes must be between -90 and 90
    // Longitudes must be between -180 and 180
    const northEastLat = ensureValidLat(northEast.lat + boundsBuffer);
    const northEastLng = ensureValidLng(northEast.lng + boundsBuffer);
    const southWestLat = ensureValidLat(southWest.lat - boundsBuffer);
    const southWestLng = ensureValidLng(southWest.lng - boundsBuffer);

    // @TODO: no need to fetch if in same area as in previous fetch — thus store in state?
    fetchOffers({
      northEastLat,
      northEastLng,
      southWestLat,
      southWestLng,
    });
  };

  const [debouncedSetPersistentMapLocation] = useDebouncedCallback(
    setPersistentMapLocation,
    // delay in ms
    1000,
    // The maximum time func is allowed to be delayed before it's invoked:
    { maxWait: 3000 },
  );

  const onViewPortChange = viewport => {
    setViewport(viewport);

    const { latitude, longitude, zoom } = viewport;
    debouncedSetPersistentMapLocation({ latitude, longitude, zoom });
  };

  const [debouncedUpdateOffers] = useDebouncedCallback(
    updateOffers,
    // delay in ms
    500,
    // The maximum time func is allowed to be delayed before it's invoked:
    { maxWait: 3500 },
  );

  const updateFeatureState = (feature, newState) => {
    const map = getMapRef();
    // console.time('TIME - updateOffers'); //eslint-disable-line
    const { source, id } = feature;
    const previousState = map.getFeatureState({
      source,
      id,
    });

    // eslint-disable-next-line no-console
    // console.log('🔵previous feature state:', featureStatePreviously);
    // eslint-disable-next-line no-console
    // console.log('🟢new feature state:', {
    //   ...featureStatePreviously,
    //   ...newFeatureState,
    // });

    map.setFeatureState(
      { source, id },
      {
        ...previousState,
        // New state merges into previous state, overriding only defined keys
        ...newState,
      },
    );
    // console.timeEnd('TIME - updateOffers'); //eslint-disable-line
  };

  const clearPreviouslyHoveredState = () => {
    if (hoveredOffer) {
      setHoveredOffer(false);
      updateFeatureState(hoveredOffer, { hover: false });
    }
  };

  // eslint-disable-next-line
  const clearPreviouslySelectedState = () => {
    // console.time('TIME - clearPreviouslySelectedState'); //eslint-disable-line
    if (selectedOffer) {
      updateFeatureState(selectedOffer, { selected: false });
      setSelectedOffer(false);
    }
    // console.timeEnd('TIME - clearPreviouslySelectedState'); //eslint-disable-line
  };

  const setSelectedState = offer => {
    // console.time(`TIME - setSelectedState ${offer.id}`); //eslint-disable-line
    // console.log('🚀 setSelectedState:'); //eslint-disable-line
    // console.log(offer); //eslint-disable-line
    // console.log(offer.toJSON()); //eslint-disable-line

    // Clear out previously selected offers
    if (selectedOffer) {
      updateFeatureState(selectedOffer, { selected: false });
    }

    // Mark newly selected offer
    updateFeatureState(offer, { selected: true, viewed: true });
    setSelectedOffer(offer);
    // console.timeEnd(`TIME - setSelectedState ${offer.id}`); //eslint-disable-line
  };

  const onHover = event => {
    if (!event?.features?.length) {
      return;
    }

    const feature = event.features[0];

    // Stop here if:
    // - feature on other than points layer, or
    // - feature doesn't have ID for some reason, or
    // - we're just hovering previously hovered feature
    if (
      feature.layer.id !== unclusteredPointLayer.id ||
      !feature.id ||
      feature.id === hoveredOffer?.id
    ) {
      return;
    }

    if (!hoveredOffer || hoveredOffer?.id !== feature.id) {
      console.log('onHover, feature:', feature); //eslint-disable-line
      clearPreviouslyHoveredState();
      setHoveredOffer(feature);
      updateFeatureState(feature, { hover: true });
    } else {
      console.log('Ignore hovering, feature, was same as previous.'); //eslint-disable-line
    }
  };

  // https://github.com/visgl/react-map-gl/blob/5.2-release/examples/zoom-to-bounds/src/app.js
  const zoomToClusterById = (clusterId, lngLat) => {
    if (!clusterId) {
      return;
    }

    const source = sourceRef?.current?.getSource();

    const newLocation = {
      latitude: lngLat[1],
      longitude: lngLat[0],
      transitionDuration: 'auto',
      transitionInterpolator: new FlyToInterpolator({ speed: 1.3 }),
    };

    if (!source) {
      // @TODO: sometimes source doesn't return map. At least center the group if no zooming — not ideal, should just re-attempt.
      setViewport({
        ...viewport,
        ...newLocation,
      });

      return;
    }

    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
      console.log('got ClusterExpansionZoom:', zoom, lngLat); // eslint-disable-line no-console
      if (err || zoom === undefined) {
        return;
      }

      // Transition map to show offers in the cluster
      setViewport({
        ...viewport,
        ...newLocation,
        zoom,
      });
    });
  };

  /**
   * React on any clicks on map or layers defined on `interactiveLayerIds` prop
   */
  const onClickMap = event => {
    const { features, lngLat } = event;
    clearPreviouslySelectedState();

    if (!features?.length) {
      // Close open offers when clicking on map canvas
      // Delegated to Angular controller; to be refactored to React
      onOfferClose();
      return;
    }

    const layerId = features[0]?.layer?.id;

    switch (layerId) {
      // Hosting or meeting offer
      case unclusteredPointLayer.id:
        if (features[0]?.id) {
          setSelectedState(features[0]);
          openOfferById(features[0].id);
        } else {
          console.log('🛑No Feature ID!', features[0]); //eslint-disable-line
        }
        break;
      // Clusters
      case clusterLayer.id:
        zoomToClusterById(features[0]?.properties?.cluster_id, lngLat);
        break;
    }
  };

  async function openOfferById(offerId) {
    console.log('openOfferById:', offerId); // eslint-disable-line no-console
    if (!offerId) {
      return;
    }

    // @TODO: cancellation when opening another offer instead
    const offer = await getOffer(offerId);

    if (offer) {
      // Delegated to Angular controller, to be refactored
      onOfferOpen(offer);
    }
  }

  // eslint-disable-next-line
  async function fetchOffers(boundingBox) {
    console.log('fetch with filters:', filters); // eslint-disable-line no-console
    try {
      // @TODO: cancellation when need to re-fetch
      const data = await queryOffers({
        filters, // JSON.stringify(filters),
        ...boundingBox,
      });
      setOffers(data);
    } catch {
      // @TODO Error handling
      process.env.NODE_ENV === 'development' &&
        // eslint-disable-next-line no-console
        console.error('Could not load offers.');
    }
  }

  // Load and store Mapbox object for quick reference on render
  useEffect(() => {
    if (!map) {
      const currentMap = getMapRef();
      // console.log('🌍 RENDER MAP getter:', currentMap); //eslint-disable-line
      setMap(currentMap);
    }
    // else {
    // console.log('🌍 RENDER MAP from cache :', map); //eslint-disable-line
    // }
  }, []);

  // Apply externally changed bounds object
  // Changed by Angular search sidebar
  useEffect(() => {
    console.log('🌀bounds: ', typeof bounds, bounds); //eslint-disable-line
    if (bounds?.northEast && bounds?.southWest) {
      zoomToBounds(bounds);
    }
  }, [bounds]);

  // Apply externally changed filters object
  // Changed by Angular search sidebar
  useEffect(() => {
    console.log('🌀filters: ', typeof filters, filters); //eslint-disable-line

    // Clear out previous open offers and such
    onOfferClose();
    clearPreviouslySelectedState();
    clearPreviouslyHoveredState();

    // Update map offers
    updateOffers();
  }, [filters]);

  // Apply externally changed location object
  // Changed by Angular controller when loading offer via URL
  useEffect(() => {
    console.log('🌀location: ', typeof location, location); //eslint-disable-line
    if (location?.lat && location?.lng) {
      setViewport({
        ...viewport,
        latitude: location.lat,
        longitude: location.lng,
        zoom: location?.zoom || DEFAULT_LOCATION.zoom,
      });
    }
  }, [location]);

  return (
    <ReactMapGL
      className="search-map"
      dragRotate={false}
      height="100%"
      /*
       * Pointer event callbacks will only query the features under the pointer
       * of `interactiveLayerIds` layers. The getCursor callback will receive
       * `isHovering:true` when hover over features of these layers.
       *
       * https://visgl.github.io/react-map-gl/docs/api-reference/interactive-map#interactivelayerids
       */
      interactiveLayerIds={[clusterLayer.id, unclusteredPointLayer.id]}
      location={[
        persistentMapLocation?.latitude ?? DEFAULT_LOCATION.lat,
        persistentMapLocation?.longitude ?? DEFAULT_LOCATION.lng,
      ]}
      mapboxApiAccessToken={MAPBOX_TOKEN}
      mapStyle={mapStyle}
      onClick={onClickMap}
      onHover={onHover}
      onInteractionStateChange={debouncedUpdateOffers}
      onMouseLeave={clearPreviouslyHoveredState}
      onViewportChange={onViewPortChange}
      ref={mapRef}
      touchRotate={false}
      {...viewport}
      width={
        '100%' /* this must come after viewport, or width gets set to fixed size via onViewportChange */
      }
    >
      {viewport.zoom <= MIN_ZOOM && <SearchMapNoContent />}
      <MapScaleControl />
      <MapNavigationControl />
      {showMapStyles && (
        <MapStyleControl mapStyle={mapStyle} setMapstyle={setMapstyle} />
      )}
      <Source
        buffer={512}
        cluster
        clusterMaxZoom={12}
        clusterRadius={50}
        data={offers}
        id={SOURCE_OFFERS}
        promoteId="id" // Use feature.properties.id as feature ID; used e.g. for hover effect with `setFeatureState()`
        ref={sourceRef}
        type="geojson"
      >
        <Layer {...clusterLayer} />
        {/* OSM and Mapbox use different fonts for cluster numbers */}
        {mapStyle === MAP_STYLE_OSM ? (
          <Layer {...clusterCountLayerOSM} />
        ) : (
          <Layer {...clusterCountLayerMapbox} />
        )}
        <Layer {...unclusteredPointLayer} />
      </Source>
    </ReactMapGL>
  );
}

SearchMap.propTypes = {
  location: PropTypes.object,
  locationBounds: PropTypes.object,
  filters: PropTypes.string,
  onOfferClose: PropTypes.func,
  onOfferOpen: PropTypes.func,
};
