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
import * as api from '../api/offers.api';
import Map from '@/modules/core/client/components/Map/index';
import SearchMapLoading from './SearchMapLoading';

// export default class SearchMap extends Component {
export default function SearchMap(props) {
  // const { t } = useTranslation('search');
  const [isFetching, setIsFetching] = useState(false);
  const [offers, setOffers] = useState([]);
  const sourceRef = React.createRef();
  const { location } = props;

  console.log('location:', location); //eslint-disable-line

  const [geojson, setGeojson] = useState(null); //eslint-disable-line

  // https://github.com/visgl/react-map-gl/blob/5.2-release/examples/zoom-to-bounds/src/app.js
  const onClickMap = event => {
    const mapboxSource = sourceRef.current.getSource();
    console.log(event, mapboxSource); //eslint-disable-line

    if (!event.features?.length) {
      return;
    }

    const clusterId = event.features[0]?.properties?.cluster_id;

    if (!clusterId) {
      return;
    }

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
  };

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

      // @TODO: no need to fetch if in same area as in previous fetch
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

  async function fetchOffers(query) {
    console.log('fetchOffers:', query); //eslint-disable-line
    setIsFetching(true);
    try {
      //   filters=%7B%22tribes%22:%5B%5D,%22types%22:%5B%22host%22,%22meet%22%5D,%22languages%22:%5B%5D,%22seen%22:%7B%22months%22:6%7D%7D&northEastLat=54.879278856608266&northEastLng=20.10172526041667&southWestLat=42.05680822944813&southWestLng=-1.8204752604166667
      // @TODO: filters
      // @TODO: cancellation when need to re-fetch
      const data = await api.getOffers(query);
      if (data.features.length) {
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
      interactiveLayerIds={[clusterLayer.id]}
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
};
