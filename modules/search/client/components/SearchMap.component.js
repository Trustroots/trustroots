// External dependencies
// import { useTranslation } from 'react-i18next';
import { Source, Layer, WebMercatorViewport } from 'react-map-gl';
import { useDebouncedCallback } from 'use-debounce';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';

// Internal dependencies
import * as api from '../api/offers.api';
import Map from '@/modules/core/client/components/Map/index';
import './search-map.less';
import {
  clusterLayer,
  clusterCountLayer,
  unclusteredPointLayer,
} from './layers';

// export default class SearchMap extends Component {
export default function SearchMap(props) {
  // const { t } = useTranslation('search');
  const [isFetching, setIsFetching] = useState(false);
  const [offers, setOffers] = useState([]);
  const sourceRef = React.createRef();
  const { location } = props;

  const [geojson, setGeojson] = useState({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-67.13734351262877, 45.137451890638886],
              [-67.13734351262877, 45.137451890638886],
            ],
          ],
        },
      },
    ],
  });

  // https://github.com/visgl/react-map-gl/blob/5.2-release/examples/zoom-to-bounds/src/app.js
  const onClickMap = event => {
    const mapboxSource = sourceRef.current.getSource(); //eslint-disable-line
    console.log(event); //eslint-disable-line

    /*
    const clusterId = feature.properties.cluster_id;


    mapboxSource.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) {
        return;
      }
      console.log(longitude, latitude, zoom);//eslint-disable-line

      /*
      this._onViewportChange({
        ...this.state.viewport,
        longitude: feature.geometry.coordinates[0],
        latitude: feature.geometry.coordinates[1],
        zoom,
        transitionDuration: 500,
      });
    });
    */
  };

  const [debouncedUpdateOffers] = useDebouncedCallback(
    ({ viewState }) => {
      // Build bounding box
      const mercatorViewport = new WebMercatorViewport(viewState);
      const p1 = mercatorViewport.unproject([viewState.width, 0]);
      const p2 = mercatorViewport.unproject([0, viewState.height]);

      console.log('->update:', viewState, mercatorViewport, p1, p2); //eslint-disable-line

      setGeojson({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[p1, p2]],
            },
          },
        ],
      });

      fetchOffers({
        northEastLat: p1[0],
        northEastLng: p1[1],
        southWestLat: p2[0],
        southWestLng: p2[1],
      });
    },
    // delay in ms
    500,
    // The maximum time func is allowed to be delayed before it's invoked:
    { maxWait: 1500 },
  );

  async function fetchOffers(query) {
    setIsFetching(true);
    try {
      //   filters=%7B%22tribes%22:%5B%5D,%22types%22:%5B%22host%22,%22meet%22%5D,%22languages%22:%5B%5D,%22seen%22:%7B%22months%22:6%7D%7D&northEastLat=54.879278856608266&northEastLng=20.10172526041667&southWestLat=42.05680822944813&southWestLng=-1.8204752604166667
      // @TODO: filters
      // @TODO: cancellation when need to re-fetch
      const data = await api.getOffers(query);
      setOffers(data);
    } finally {
      setIsFetching(false);
    }
  }

  useEffect(() => {
    fetchOffers({
      northEastLat: 54.879278856608266,
      northEastLng: 20.10172526041667,
      southWestLat: 42.05680822944813,
      southWestLng: -1.8204752604166667,
    });
  }, []);

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
      {isFetching && <h1>Loading...</h1>}
      <Source
        buffer={0} // 512
        cluster={false}
        // clusterMaxZoom={14}
        // clusterRadius={50}
        data={offers}
        id="offers"
        ref={sourceRef}
        type="geojson"
      >
        <Layer {...clusterLayer} />
        <Layer {...clusterCountLayer} />
        <Layer {...unclusteredPointLayer} />
      </Source>
      <Source id="example" type="geojson" data={geojson}>
        <Layer type="fill" paint={{ 'fill-color': '#007cbf' }} />
      </Source>
    </Map>
  );
}

SearchMap.propTypes = {
  location: PropTypes.array,
};
