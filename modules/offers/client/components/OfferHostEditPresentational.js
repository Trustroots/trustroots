import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Tab, Tabs } from 'react-bootstrap';

import Availability from './OfferHostEditAvailability';
import Description from './OfferHostEditDescription';
import Location from './OfferHostEditLocation';
import Navigation from '@/modules/core/client/components/Navigation';

export default function OfferHostEditPresentational({
  disabled,
  status,
  maxGuests,
  description,
  noOfferDescription,
  location,
  firstTimeAround,
  isDefaultLocation,
  onChangeStatus,
  onChangeMaxGuests,
  onChangeDescription,
  onChangeNoOfferDescription,
  onChangeLocation,
  onSubmit,
}) {
  const [tab, setTab] = useState(0);

  const isLocationDisabled = status === 'no';

  return (
    <section className="offers-edit">
      <Button
        className="btn-lg btn-inverse-primary pull-right hidden-xs"
        disabled={disabled}
        onClick={onSubmit}
        aria-hidden={true}
      >
        Save and Exit
      </Button>
      {/*
      <button
        type="submit"
        className="btn btn-lg btn-inverse-primary pull-right hidden-xs"
        ng-disabled="offerHostEdit.isLoading ||
          (offerHostEdit.offer.status!=='no' && offerHostEdit.isDescriptionTooShort)"
        uib-tooltip="Write longer description first"
        tooltip-enable="offerHostEdit.isDescriptionTooShort && offerHostEdit.offer.status !== 'no'"
        tooltip-placement="bottom"
        aria-hidden="true"
      >
        Save and Exit
      </button>
      */}
      <Tabs
        id="offer-host-edit-tabs"
        className="offer-tabs"
        activeKey={tab}
        onSelect={key => setTab(key)}
        animation={false}
      >
        <Tab eventKey={0} title="Availability">
          <Availability
            status={status}
            maxGuests={maxGuests}
            onChangeStatus={onChangeStatus}
            onChangeMaxGuests={onChangeMaxGuests}
          />
        </Tab>
        <Tab eventKey={1} title="Description">
          <Description
            status={status}
            description={description}
            noOfferDescription={noOfferDescription}
            onChangeDescription={onChangeDescription}
            onChangeNoOfferDescription={onChangeNoOfferDescription}
          />
        </Tab>
        <Tab eventKey={2} title="Location" disabled={isLocationDisabled}>
          <Location
            status={status}
            firstTimeAround={firstTimeAround}
            defaultZoom={isDefaultLocation ? 6 : 16}
            location={location}
            onChangeLocation={onChangeLocation}
          />
        </Tab>
      </Tabs>

      <Navigation
        tab={tab}
        tabs={isLocationDisabled ? 2 : 3}
        tabDone={3}
        onBack={() => setTab(tab => tab - 1)}
        onNext={() => setTab(tab => tab + 1)}
        onSubmit={onSubmit}
      />
    </section>
  );
}

OfferHostEditPresentational.propTypes = {
  disabled: PropTypes.bool.isRequired,
  status: PropTypes.oneOf(['yes', 'maybe', 'no']).isRequired,
  maxGuests: PropTypes.number.isRequired,
  description: PropTypes.string.isRequired,
  noOfferDescription: PropTypes.string.isRequired,
  location: PropTypes.object.isRequired,
  firstTimeAround: PropTypes.bool.isRequired,
  isDefaultLocation: PropTypes.bool.isRequired,
  onChangeStatus: PropTypes.func.isRequired,
  onChangeMaxGuests: PropTypes.func.isRequired,
  onChangeDescription: PropTypes.func.isRequired,
  onChangeNoOfferDescription: PropTypes.func.isRequired,
  onChangeLocation: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};
