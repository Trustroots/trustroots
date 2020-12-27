import PropTypes from 'prop-types';

export const interactionsType = PropTypes.shape({
  met: PropTypes.bool.isRequired,
  hostedMe: PropTypes.bool.isRequired,
  hostedThem: PropTypes.bool.isRequired,
});

export const experienceType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  public: PropTypes.bool.isRequired,
  userFrom: PropTypes.object.isRequired,
  userTo: PropTypes.object.isRequired,
  created: PropTypes.string.isRequired,
  interactions: interactionsType.isRequired,
  recommend: PropTypes.bool.isRequired,
  feedbackPublic: PropTypes.string.isRequired,
  response: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    created: PropTypes.strimg.isRequired,
    interactions: interactionsType.isRequired,
    recommend: PropTypes.bool.isRequired,
    feedbackPublic: PropTypes.string.isRequired,
  }),
});
