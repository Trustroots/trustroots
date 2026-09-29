import PropTypes from 'prop-types';

export interface ExperienceUser {
  _id: string;
  username: string;
  name?: string;
  displayName?: string;
  avatar?: string;
  created?: string;
  gender?: string;
}

export interface ExperienceInteractions {
  met: boolean;
  guest: boolean;
  host: boolean;
}

export type ExperienceRecommendation = 'yes' | 'no' | 'unknown';

export interface Experience {
  _id: string;
  public: boolean;
  userFrom: ExperienceUser;
  userTo: ExperienceUser;
  created: string;
  interactions: ExperienceInteractions;
  recommend: ExperienceRecommendation;
  feedbackPublic: string;
  response?: Experience | null;
}

export interface ExperienceMine {
  userFrom: string | ExperienceUser;
  public: boolean;
  response?: Experience | null;
}

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
