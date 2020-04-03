import React from 'react';
import PropTypes from 'prop-types';

export default function OfferHostEditAvailability({
  status,
  maxGuests,
  onChangeStatus,
  onChangeMaxGuests,
}) {
  return (
    <>
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
    </>
  );
}

OfferHostEditAvailability.propTypes = {
  status: PropTypes.oneOf(['yes', 'maybe', 'no']).isRequired,
  maxGuests: PropTypes.number.isRequired,
  onChangeStatus: PropTypes.func.isRequired,
  onChangeMaxGuests: PropTypes.func.isRequired,
};
