import React from 'react';
import PropTypes from 'prop-types';
import Map from '@/modules/core/client/components/Map';
import classnames from 'classnames';

export default function OfferHostEditLocation({
  firstTimeAround,
  status,
  defaultZoom,
  location,
  onChangeLocation,
}) {
  firstTimeAround;
  status;
  onChangeLocation;
  return (
    <div className="panel panel-default offer-panel-map">
      {firstTimeAround && (
        <div
          className="alert alert-info offer-map-guide"
          role="dialog"
          aria-labelledby="firstTimeAroundLabel"
          aria-describedby="firstTimeAroundDescription"
        >
          <p className="lead" role="document">
            <strong id="firstTimeAroundLabel">
              Set your hosting location on the map.
            </strong>
            <br />
            <br />
            <span aria-hidden="true">
              Zoom in and drag the map below to place the marker over your home.
            </span>
            <br />
            <br />
            <span id="firstTimeAroundDescription">
              Your exact location won&apos;t be revealed to others; the location
              is publicly randomized by a couple of hundred meters.
            </span>
            <br />
            <br />
            <button
              type="button"
              className="btn btn-lg btn-info"
              data-dismiss="dialog"
              aria-label="Close information dialog about hosting location map"
              onClick={() => {}}
            >
              Got it!
            </button>
          </p>
        </div>
      )}

      <div className="panel-body">
        <p id="offerLocation" className="lead">
          <strong>
            Zoom in and drag the map below to place the marker over your home.
          </strong>
          <br />
          The location is publicly shown, randomized by a couple hundred meters.
        </p>

        {/* Search location */}
        <div
          className="form-group has-feedback offer-map-location-search"
          ng-if="::app.appSettings.mapbox.publicKey"
        >
          <label htmlFor="search-query" className="sr-only">
            Search for places on the map
          </label>
          <span
            className="form-control-feedback visible-xs-inline"
            aria-hidden="true"
          >
            <span className="icon-search icon-lg text-muted"></span>
          </span>
          <input
            type="text"
            id="search-query"
            className="form-control input-lg"
            placeholder="Search"
            ng-model="offerHostEdit.searchQuery"
            tr-location
            tr-location-center="offerHostEdit.mapCenter"
          />
        </div>
        {/* /Search location */}
      </div>

      <div className="offer-map">
        <Map
          id="offer-add-location-canvas"
          width="100%"
          height="100%"
          zoom={defaultZoom}
          location={[location.lat, location.lng]}
        />
        {/*
        <leaflet
          ng-if="offerHostEdit.offerTab === 2"
          defaults="offer.mapDefaults"
          layers="offer.mapLayers"
          lf-center="offerHostEdit.mapCenter"
          aria-describedby="offerLocation"
          id="offer-add-location-canvas"
        ></leaflet>
        */}
        <div
          className={classnames('offer-location-overlay', {
            'offer-hosting-yes': status === 'yes',
            'offer-hosting-maybe': status === 'maybe',
          })}
        ></div>
      </div>
    </div>
  );
}

OfferHostEditLocation.propTypes = {
  firstTimeAround: PropTypes.bool,
  status: PropTypes.oneOf(['yes', 'maybe', 'no']).isRequired,
  defaultZoom: PropTypes.number.isRequired,
  location: PropTypes.object.isRequired,
  onChangeLocation: PropTypes.func.isRequired,
};
