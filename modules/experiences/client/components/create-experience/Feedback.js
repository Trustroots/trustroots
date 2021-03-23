import PropTypes from 'prop-types';
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function Feedback({
  feedback,
  recommend,
  report,
  onChangeFeedback,
}) {
  const { t } = useTranslation('experiences');

  /*
   * Functions passing strings to translation fuction for translation scripts
   */
  const getRecommend = (recommendCode, report) => {
    switch (recommendCode) {
      case 'yes':
        return t('Did you enjoy their cooking? singing?');
      case 'no':
        return report
          ? t('Did you not like their cooking? singing?')
          : t('Did you not enjoy their cooking? singing?');
      case 'unknown':
        return t('Did you maybe enjoy their cooking? singing?');
      default:
        return undefined;
    }
  };

  return (
    <div className="panel panel-default">
      <div className="panel-heading">
        <h4 id="feedback-public-question">
          {t(
            'Would you like to describe something about your experience with them?',
          )}{' '}
          ({t('Optional')})
        </h4>
      </div>
      <div
        className="panel-body"
        role="group"
        aria-labelledby="feedback-public-question"
      >
        <p>{getRecommend(recommend, report)}</p>
        <br />
        <label htmlFor="feedback-message" className="control-label">
          {t('Public feedback')}
        </label>
        <textarea
          className="form-control input-lg"
          rows="7"
          id="feedback-message"
          onChange={event => onChangeFeedback(event.target.value)}
          value={feedback}
        ></textarea>
        <span className="help-block">
          {t(
            'The answer you write will be publicly available on their profile.',
          )}
          <br />
        </span>
      </div>
    </div>
  );
}

Feedback.propTypes = {
  feedback: PropTypes.string.isRequired,
  recommend: PropTypes.string,
  report: PropTypes.bool,
  onChangeFeedback: PropTypes.func.isRequired,
};
