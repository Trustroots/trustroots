import React from 'react';
import PropTypes from 'prop-types';

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
  return (
    <ul>
      <li>first time around: {JSON.stringify(firstTimeAround)}</li>
      <li>
        status:
        <select
          value={status}
          onChange={event => onChangeStatus(event.target.value)}
        >
          <option value="yes">yes</option>
          <option value="maybe">maybe</option>
          <option value="no">no</option>
        </select>
      </li>
      <li>
        max guests:
        <button onClick={() => onChangeMaxGuests(1, '-')}>-</button>
        <input
          type="number"
          min="1"
          step="1"
          value={maxGuests}
          onChange={event => onChangeMaxGuests(+event.target.value, '=')}
        />
        <button onClick={() => onChangeMaxGuests(1, '+')}>+</button>
      </li>
      <li>
        description:
        <textarea
          value={description}
          onChange={event => onChangeDescription(event.target.value)}
        />
      </li>
      <li>
        no offer description:
        <textarea
          value={noOfferDescription}
          onChange={event => onChangeNoOfferDescription(event.target.value)}
        />
      </li>
      <li>is default location: {JSON.stringify(isDefaultLocation)}</li>
      <li>
        location:
        <input
          value={location.lat}
          onChange={event =>
            onChangeLocation({ ...location, lat: +event.target.value })
          }
        />
        <input
          value={location.lng}
          onChange={event =>
            onChangeLocation({ ...location, lng: +event.target.value })
          }
        />
      </li>
      <li>
        <button disabled={disabled} onClick={onSubmit}>
          Save and Exit
        </button>
      </li>
    </ul>
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
