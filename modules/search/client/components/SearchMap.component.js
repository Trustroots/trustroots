// External dependencies
// import { useTranslation } from 'react-i18next';
import { Source, Layer } from 'react-map-gl';
import { useDebouncedCallback } from 'use-debounce';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react'; //eslint-disable-line

// Internal dependencies
import './search-map.less';
import {
  clusterLayer,
  clusterCountLayer,
  unclusteredPointLayer,
} from './layers';
import { getOffer, queryOffers } from '@/modules/offers/client/api/offers.api';
import Map from '@/modules/core/client/components/Map/index';
import SearchMapLoading from './SearchMapLoading';

// export default class SearchMap extends Component {
export default function SearchMap(props) {
  // const { t } = useTranslation('search');
  const [isFetching, setIsFetching] = useState(false);
  const [offers, setOffers] = useState({
    features: [],
    type: 'FeatureCollection',
  });
  const sourceRef = React.createRef();
  const { mapCenter, onOfferOpen, onOfferClose } = props;
  const [geojson, setGeojson] = useState(null); //eslint-disable-line
  // eslint-disable-next-line
  const [viewport, setViewport] = useState({
    latitude: mapCenter.lat,
    longitude: mapCenter.lng,
    zoom: mapCenter.zoom,
  });

  /**
   * Hook on map interactions to update features
   */
  const updateOffers = () => {
    const mapboxSource = sourceRef?.current?.getSource();
    // eslint-disable-next-line
    console.log('updateOffers:', mapboxSource);

    // @TODO: better way to get bounds?
    // @TODO: expand bound slightly to load more as "buffer"
    // https://docs.mapbox.com/mapbox-gl-js/api/geography/#lnglatbounds
    const bounds = mapboxSource?.map ? mapboxSource.map.getBounds() : false;

    // Too early for this, map was not initialized yet
    if (!bounds) {
      return;
    }

    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();

    setGeojson({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: northEast.toArray(),
          },
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: southWest.toArray(),
          },
        },
      ],
    });

    // @TODO: no need to fetch if in same area as in previous fetch — thus store in state?
    fetchOffers({
      northEastLat: northEast.lat, // [1],
      northEastLng: northEast.lng, // [0],
      southWestLat: southWest.lat, // [1],
      southWestLng: southWest.lng, // [0],
    });
  };

  const [debouncedUpdateOffers] = useDebouncedCallback(
    updateOffers,
    // delay in ms
    500,
    // The maximum time func is allowed to be delayed before it's invoked:
    { maxWait: 1500 },
  );

  /**
   * React on any clicks on map or layers defined on `interactiveLayerIds` prop
   */
  const onClickMap = event => {
    console.log('onClickMap:', event); //eslint-disable-line

    // Delegated to Angular controller
    onOfferClose();

    if (!event?.features?.length) {
      return;
    }

    const layerId = event.features[0]?.layer?.id;

    switch (layerId) {
      case 'unclustered-point':
        openOfferById(event.features[0]?.properties?._id);
        break;
      case 'clusters':
        zoomToClusterById(
          event.features[0]?.properties?.cluster_id,
          event.lngLat,
        );
        break;
      default:
        // @TODO: Send to Sentry.io
        // eslint-disable-next-line no-console
        console.error('Map: unhandled click event', event);
    }
  };

  // https://github.com/visgl/react-map-gl/blob/5.2-release/examples/zoom-to-bounds/src/app.js
  function zoomToClusterById(clusterId, lngLat) {
    console.log('zoomToClusterById:', clusterId); //eslint-disable-line

    if (!clusterId) {
      return;
    }

    const mapboxSource = sourceRef.current.getSource();
    // console.log('mapboxSource:', mapboxSource); //eslint-disable-line

    // eslint-disable-next-line
    mapboxSource.getClusterExpansionZoom(clusterId, (err, newZoom) => {
      console.log('got ClusterExpansionZoom:', newZoom, lngLat); //eslint-disable-line
      if (err) {
        return;
      }
      // Do the map transition
      /*
      _onViewportChange({
        ...this.state.viewport,
        longitude: event.lngLat[0],
        latitude: event.lngLat[1],
        //longitude: feature.geometry.coordinates[0],
        //latitude: feature.geometry.coordinates[1],
        zoom,
        transitionDuration: 500,
      });
      */
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
      // Delegated to Angular controller
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
        // eslint-disable-next-line
        console.log('Got offers:', data);
        setOffers(data);
      }
    } finally {
      setIsFetching(false);
    }
  }

  /*
  useEffect(() => {
    fetchOffers({
      southWestLng: 5.6465709209,
      northEastLng: 6.6291606426,
      northEastLat: 50.2054799638,
      southWestLat: 49.3366519447,
    });
  }, []);
  */

  return (
    <Map
      className="search-map"
      height="100%"
      location={[mapCenter.lat, mapCenter.lng]}
      showMapStyles
      zoom={mapCenter.zoom}
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
      width={
        '100%' /* this must come after viewport, or width gets set to fixed size via onViewportChange */
      }
    >
      {isFetching && <SearchMapLoading />}
      <Source
        buffer={0} // 512 @TODO what's this?
        cluster={true}
        clusterMaxZoom={14}
        clusterRadius={50}
        data={offers}
        id="offers"
        ref={sourceRef}
        type="geojson"
      >
        <Layer {...clusterLayer} />
        <Layer {...clusterCountLayer} />
        <Layer {...unclusteredPointLayer} />
      </Source>
      {/* @TODO: Remove the following source+layer, it's there just to indicate bounding box visually */}
      {geojson && (
        <Source id="example" type="geojson" data={geojson}>
          <Layer
            type="circle"
            paint={{
              'circle-color': '#f1f075', // #f28cb1
              'circle-radius': 20,
            }}
          />
        </Source>
      )}
    </Map>
  );
}

SearchMap.propTypes = {
  mapCenter: PropTypes.object,
  onOfferClose: PropTypes.func,
  onOfferOpen: PropTypes.func,
};
