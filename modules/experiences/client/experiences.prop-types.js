import PropTypes from 'prop-types';

export const interactionsType = PropTypes.shape({
  met: PropTypes.bool.isRequired,
  guest: PropTypes.bool.isRequired,
  host: PropTypes.bool.isRequired,
});

const recommendType = PropTypes.oneOf(['yes', 'no', 'unknown']);

export const experienceType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  public: PropTypes.bool.isRequired,
  userFrom: PropTypes.object.isRequired,
  userTo: PropTypes.object.isRequired,
  created: PropTypes.string.isRequired,
  interactions: interactionsType.isRequired,
  recommend: recommendType.isRequired,
  feedbackPublic: PropTypes.string.isRequired,
  response: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    created: PropTypes.string.isRequired,
    interactions: interactionsType.isRequired,
    recommend: recommendType.isRequired,
    feedbackPublic: PropTypes.string.isRequired,
  }),
});
