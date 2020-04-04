import PropTypes from 'prop-types';

export const userType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
  displayName: PropTypes.string.isRequired,
});
