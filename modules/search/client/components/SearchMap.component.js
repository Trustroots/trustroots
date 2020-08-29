// External dependencies
// import { useTranslation } from 'react-i18next';
import { Source, Layer, WebMercatorViewport } from 'react-map-gl';
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
  const [offers, setOffers] = useState([]);
  const sourceRef = React.createRef();
  const { location, onOfferOpen, onOfferClose } = props;

  console.log('location:', location); //eslint-disable-line

  const [geojson, setGeojson] = useState(null); //eslint-disable-line

  const [debouncedUpdateOffers] = useDebouncedCallback(
    ({ viewState }) => {
      console.log('useDebouncedCallback'); //eslint-disable-line
      // Build bounding box
      // @TODO: better way to get bounds? Where's the utility function for it?
      const mercatorViewport = new WebMercatorViewport(viewState);
      const northEast = mercatorViewport.unproject([viewState.width, 0]);
      const southWest = mercatorViewport.unproject([0, viewState.height]);

      /*
      setGeojson({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: northEast,
            },
          },
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: southWest,
            },
          },
        ],
      });
      */

      // @TODO: no need to fetch if in same area as in previous fetch — thus store in state?
      fetchOffers({
        northEastLat: northEast[1],
        northEastLng: northEast[0],
        southWestLat: southWest[1],
        southWestLng: southWest[0],
      });
    },
    // delay in ms
    500,
    // The maximum time func is allowed to be delayed before it's invoked:
    { maxWait: 1500 },
  );

  const onClickMap = event => {
    console.log('onClickMap:', event); //eslint-disable-line

    // Delegated to Angular controller
    onOfferClose();

    if (!event.features?.length) {
      return;
    }

    const layer = event.features[0]?.layer?.id;

    switch (layer) {
      case 'unclustered-point':
        openOfferById(event.features[0]?.properties?._id);
        break;
      case 'clusters':
        zoomToClusterById(event.features[0]?.properties?.cluster_id);
        break;
      default:
        // eslint-disable-next-line no-console
        console.error('Map: unhandled click event');
    }
  };

  // https://github.com/visgl/react-map-gl/blob/5.2-release/examples/zoom-to-bounds/src/app.js
  function zoomToClusterById(clusterId) {
    console.log('zoomToClusterById:', clusterId); //eslint-disable-line

    if (!clusterId) {
      return;
    }

    const mapboxSource = sourceRef.current.getSource();
    console.log('mapboxSource:', mapboxSource); //eslint-disable-line

    // eslint-disable-next-line
    mapboxSource.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) {
        return;
      }
      // Do the map transition
      /*
      _onViewportChange({
        ...this.state.viewport,
        longitude: event.lngLat[0],
        latitude: event.lngLat[1],
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
      location={[location.lat, location.lng]}
      showMapStyles
      width="100%"
      zoom={location.zoom}
      interactiveLayerIds={[clusterLayer.id, unclusteredPointLayer.id]}
      onClick={onClickMap}
      onViewStateChange={debouncedUpdateOffers}
    >
      {isFetching && <SearchMapLoading />}
      <Source
        buffer={0} // 512
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
  location: PropTypes.object,
  onOfferClose: PropTypes.func,
  onOfferOpen: PropTypes.func,
};
