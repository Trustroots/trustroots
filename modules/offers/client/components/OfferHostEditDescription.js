import React from 'react';
import PropTypes from 'prop-types';

export default function OfferHostEditDescription({
  status,
  description,
  noOfferDescription,
  onChangeDescription,
  onChangeNoOfferDescription,
}) {
  return status === 'no' ? (
    <li>
      no offer description:
      <textarea
        value={noOfferDescription}
        onChange={event => onChangeNoOfferDescription(event.target.value)}
      />
    </li>
  ) : (
    <li>
      description:
      <textarea
        value={description}
        onChange={event => onChangeDescription(event.target.value)}
      />
    </li>
  );
}

OfferHostEditDescription.propTypes = {
  status: PropTypes.oneOf(['yes', 'maybe', 'no']).isRequired,
  description: PropTypes.string.isRequired,
  noOfferDescription: PropTypes.string.isRequired,
  onChangeDescription: PropTypes.func.isRequired,
  onChangeNoOfferDescription: PropTypes.func.isRequired,
};
