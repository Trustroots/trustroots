import PropTypes from 'prop-types';
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function Feedback({ feedback, onChangeFeedback }) {
  const { t } = useTranslation('references');

  return (
    <div className="panel panel-default">
      <div className="panel-heading">
        <h4 id="feedback-public-question">
          {t('Would you like to describe something about them?')}&nbsp; (
          {t('Optional')})
        </h4>
      </div>
      <div
        className="panel-body"
        role="group"
        aria-labelledby="feedback-public-question"
      >
        <p>{t('Did you enjoy their cooking? singing?')}</p>
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
            'The answer you write will be publicaly available on their profile',
          )}
          <br />
        </span>
      </div>
    </div>
  );
}

Feedback.propTypes = {
  feedback: PropTypes.string.isRequired,
  onChangeFeedback: PropTypes.func.isRequired,
};
