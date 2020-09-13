// External dependencies
// import { useTranslation } from 'react-i18next';
import { useTranslation } from 'react-i18next';
import { useDebouncedCallback } from 'use-debounce';
import PropTypes from 'prop-types';
import React, { createRef, useEffect, useState } from 'react';
import ReactMapGL, { FlyToInterpolator, Layer, Source } from 'react-map-gl';

// Internal dependencies
import { getMapBoxToken } from '@/modules/core/client/utils/map';
import {
  MAP_STYLE_DEFAULT,
  MAP_STYLE_OSM,
} from '@/modules/core/client/components/Map/constants';
import { HEATMAP_MIN_ZOOM, SOURCE_HEATMAP, SOURCE_OFFERS } from './constants';
import MapNavigationControl from '@/modules/core/client/components/Map/MapNavigationControl';
import MapScaleControl from '@/modules/core/client/components/Map/MapScaleControl';
import MapStyleControl from '@/modules/core/client/components/Map/MapStyleControl';
import { ensureValidLat, ensureValidLng } from '../utils';

import {
  clusterCountLayerMapbox,
  clusterCountLayerOSM,
  clusterLayer,
  heatMapLayer,
  unclusteredPointLayer,
} from './layers';
import { getOffer, queryOffers } from '@/modules/offers/client/api/offers.api';
// import Map from '@/modules/core/client/components/Map/index';
import SearchMapLoading from './SearchMapLoading';
import NoContent from '@/modules/core/client/components/NoContent';
import './search-map.less';

// export default class SearchMap extends Component {
export default function SearchMap(props) {
  const { mapCenter, onOfferOpen, onOfferClose } = props;
  // eslint-disable-next-line
  const [interactionState, setInteractionState] = useState({});
  const [isFetching, setIsFetching] = useState(false);
  const [mapStyle, setMapstyle] = useState(MAP_STYLE_DEFAULT);
  const [hoveredOffer, setHoveredOffer] = useState(false); //eslint-disable-line
  const [selectedOffer, setSelectedOffer] = useState(false); //eslint-disable-line
  const [offers, setOffers] = useState({
    features: [],
    type: 'FeatureCollection',
  });
  const [viewport, setViewport] = useState({
    latitude: mapCenter.lat,
    longitude: mapCenter.lng,
    zoom: mapCenter.zoom,
  });
  const { t } = useTranslation('search');
  const MAPBOX_TOKEN = getMapBoxToken();
  // If no mapbox token, and we're in production, don't show the style switcher
  const showMapStyles = !!MAPBOX_TOKEN || process.env.NODE_ENV !== 'production';
  const offersSourceRef = createRef();
  const mapRef = createRef();

  /**
   * Hook on map interactions to update features
   */
  const updateOffers = () => {
    // Don't fetch if viewing the whole world
    if (viewport.zoom <= HEATMAP_MIN_ZOOM) {
      return;
    }

    const mapboxSource = offersSourceRef?.current?.getSource();
    // eslint-disable-next-line
    console.log('updateOffers:', mapboxSource);

    // Too early for this, map was not initialized yet
    if (!mapboxSource?.map) {
      // eslint-disable-next-line
      console.log('updateOffers bailed — too early', mapboxSource);
      return;
    }

    // @TODO: better way to get bounds?
    // @TODO: expand bound slightly to load more as "buffer"
    // https://docs.mapbox.com/mapbox-gl-js/api/geography/#lnglatbounds
    const bounds = mapboxSource.map.getBounds();
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();
    const zoom = mapboxSource.map.getZoom();

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

  const [debouncedUpdateOffers] = useDebouncedCallback(
    updateOffers,
    // delay in ms
    500,
    // The maximum time func is allowed to be delayed before it's invoked:
    { maxWait: 1500 },
  );

  // Get the Mapbox object for direct manipulation
  // @TODO set just once and store?
  const getMapRef = () => {
    const mapboxSource = offersSourceRef?.current?.getSource();
    return mapboxSource?.map;
  };

  const updateFeatureState = (map, { source, id }, newFeatureState) => {
    if (!map) {
      console.log('🛑No map!'); //eslint-disable-line
      return;
    }

    const featureStatePreviously = map.getFeatureState({
      source,
      id,
    });

    // eslint-disable-next-line no-console
    console.log('🔵previous feature state:', featureStatePreviously);
    // eslint-disable-next-line no-console
    console.log('🟢new feature state:', {
      ...featureStatePreviously,
      ...newFeatureState,
    });

    map.setFeatureState(
      { source, id },
      {
        ...featureStatePreviously,
        // New state merges into previous state, overriding only defined keys
        ...newFeatureState,
      },
    );
  };

  const clearPreviouslyHoveredState = () => {
    if (hoveredOffer) {
      // @TODO set just once and store in state?
      const map = getMapRef();

      // Too early for this, map was not initialized yet
      if (!map) {
        console.log('🛑Tried map too early 1.'); //eslint-disable-line
        return;
      }

      setHoveredOffer(false);
      updateFeatureState(map, hoveredOffer, { hover: false });
    }
  };

  // eslint-disable-next-line
  const clearPreviouslySelectedState = () => {
    if (selectedOffer) {
      // @TODO set just once and store in state?
      const map = getMapRef();

      // Too early for this, map was not initialized yet
      if (!map) {
        console.log('🛑Tried map too early 4.'); //eslint-disable-line
        return;
      }

      updateFeatureState(map, selectedOffer, { selected: false });

      setSelectedOffer(false);
    }
  };

  // eslint-disable-next-line
  const setSelectedState = offer => {
    console.log('🚀 setSelectedState:', offer); //eslint-disable-line
    // @TODO set just once and store in state?
    const map = getMapRef();

    // Too early for this, map was not initialized yet
    if (!map) {
      console.log('🛑Tried map too early 5.'); //eslint-disable-line
      return;
    }

    updateFeatureState(map, offer, { selected: true });
    setSelectedOffer(offer);
  };

  const onHover = event => {
    if (!event?.features?.length) {
      return;
    }

    const feature = event.features[0];

    // Stop here if:
    // - feature on other than points layer
    // - feature doesn't have ID for some reason, or
    // - we're just hovering previously hovered feature, or
    if (
      feature.layer.id !== unclusteredPointLayer.id ||
      !feature.id ||
      feature.id === hoveredOffer?.id
    ) {
      return;
    }

    // @TODO set just once and store in state?
    const map = getMapRef();

    // Too early for this, map was not initialized yet
    if (!map) {
      console.log('🛑Tried map too early 3.'); //eslint-disable-line
      return;
    }

    if (!hoveredOffer || hoveredOffer?.id !== feature.id) {
      console.log('onHover, feature:', feature); //eslint-disable-line
      clearPreviouslyHoveredState();
      setHoveredOffer(feature);
      updateFeatureState(map, feature, { hover: true });
    } else {
      console.log('Ignore hovering, feature, was same as previous.'); //eslint-disable-line
    }
  };

  /**
   * React on any clicks on map or layers defined on `interactiveLayerIds` prop
   */
  const onClickMap = event => {
    console.log('onClickMap:', event); //eslint-disable-line
    const { features, lngLat } = event;

    // Delegated to Angular controller, to be refactored
    onOfferClose();
    clearPreviouslySelectedState();

    if (!features?.length) {
      return;
    }

    const layerId = features[0]?.layer?.id;

    switch (layerId) {
      case unclusteredPointLayer.id:
        if (features[0]?.id) {
          setSelectedState(features[0]);
          openOfferById(features[0].id);
        }
        break;
      case clusterLayer.id:
        zoomToClusterById(features[0]?.properties?.cluster_id, lngLat);
        break;
      default:
        // @TODO: Send to Sentry.io
        // eslint-disable-next-line no-console
        console.error('Map: unhandled click event', event);
    }
  };

  // https://github.com/visgl/react-map-gl/blob/5.2-release/examples/zoom-to-bounds/src/app.js
  function zoomToClusterById(clusterId, lngLat) {
    if (!clusterId) {
      return;
    }

    const mapboxSource = offersSourceRef?.current?.getSource();
    // console.log('mapboxSource:', mapboxSource); //eslint-disable-line

    if (!mapboxSource) {
      return;
    }

    // eslint-disable-next-line
    mapboxSource.getClusterExpansionZoom(clusterId, (err, newZoom) => {
      console.log('got ClusterExpansionZoom:', newZoom, lngLat); //eslint-disable-line
      if (err || newZoom === undefined) {
        return;
      }

      // Transition map to show offers in the cluster
      setViewport({
        ...viewport,
        latitude: lngLat[1],
        longitude: lngLat[0],
        transitionDuration: 'auto',
        transitionInterpolator: new FlyToInterpolator({ speed: 1.2 }),
        zoom: newZoom,
      });
    });
  }

  async function openOfferById(offerId) {
    console.log('openOfferById:', offerId); //eslint-disable-line
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
  async function fetchOffers(query) {
    console.log('fetchOffers:', query); //eslint-disable-line
    setIsFetching(true);

    try {
      //   filters=%7B%22tribes%22:%5B%5D,%22types%22:%5B%22host%22,%22meet%22%5D,%22languages%22:%5B%5D,%22seen%22:%7B%22months%22:6%7D%7D&northEastLat=54.879278856608266&northEastLng=20.10172526041667&southWestLat=42.05680822944813&southWestLng=-1.8204752604166667
      // @TODO: filters from Angular controller
      // @TODO: cancellation when need to re-fetch
      const data = await queryOffers(query);
      if (data?.features?.length) {
        setOffers(data);
      }
    } catch {
      // @TODO Error handling
      // eslint-disable-next-line no-console
      console.error('Could not load offers. Re-attempt?');
    } finally {
      setIsFetching(false);
    }
  }

  // Load offers on initial map load
  useEffect(() => debouncedUpdateOffers(), []);

  return (
    <ReactMapGL
      dragRotate={false}
      mapboxApiAccessToken={MAPBOX_TOKEN}
      mapStyle={mapStyle}
      onViewportChange={setViewport}
      ref={mapRef}
      onHover={onHover}
      onMouseLeave={clearPreviouslyHoveredState}
      touchRotate={false}
      className="search-map"
      height="100%"
      location={[mapCenter.lat, mapCenter.lng]}
      /*
       * Pointer event callbacks will only query the features under the pointer
       * of `interactiveLayerIds` layers. The getCursor callback will receive
       * `isHovering:true` when hover over features of these layers.
       *
       * https://visgl.github.io/react-map-gl/docs/api-reference/interactive-map#interactivelayerids
       */
      interactiveLayerIds={[clusterLayer.id, unclusteredPointLayer.id]}
      onClick={onClickMap}
      onInteractionStateChange={debouncedUpdateOffers}
      {...viewport}
      width={
        '100%' /* this must come after viewport, or width gets set to fixed size via onViewportChange */
      }
    >
      {isFetching && <SearchMapLoading />}
      {viewport.zoom <= HEATMAP_MIN_ZOOM && (
        <NoContent
          className="search-map-no-content"
          icon="users"
          message={t('Zoom closer to find members.')}
        />
      )}
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
        ref={offersSourceRef}
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
      <Source buffer={0} data={offers} id={SOURCE_HEATMAP} type="geojson">
        <Layer {...heatMapLayer} />
      </Source>
    </ReactMapGL>
  );
}

SearchMap.propTypes = {
  mapCenter: PropTypes.object,
  onOfferClose: PropTypes.func,
  onOfferOpen: PropTypes.func,
};
