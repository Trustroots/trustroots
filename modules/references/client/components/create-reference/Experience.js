import React from 'react';
import PropTypes from 'prop-types';
import { ToggleButton, ToggleButtonGroup } from 'react-bootstrap';
import '@/config/client/i18n';
import { useTranslation } from 'react-i18next';
import Report from './Report';

export default function Experience({
  primaryInteraction,
  comfortable,
  report,
  reportMessage,
  onChangeRecommend,
  onChangeReport,
  onChangeReportMessage,
}) {
  const { t } = useTranslation('references');

  const recommendQuestions = {
    hostedMe: t('Did you feel comfortable being hosted by $username?'),
    hostedThem: t('Did you feel comfortable hosting $username?'),
    met: t('Did you feel comfortable meeting $username?'),
  };

  const question = recommendQuestions[primaryInteraction];

  return (
    <div className="panel panel-default">
      <div className="panel-heading">
        <h4 id="did-you-feel-comfortable-question">{question}</h4>
      </div>
      <div className="panel-body">
        <ToggleButtonGroup
          type="radio"
          name="comfortable"
          onChange={onChangeRecommend}
          value={comfortable}
          aria-labelledby="did-you-feel-comfortable-question"
        >
          <ToggleButton
            className="btn btn-lg comfortable-reply-button"
            aria-checked={comfortable === 'yes'}
            value="yes"
            bsStyle="default"
            bsSize="large"
          >
            {t('Yes')}
          </ToggleButton>
          <ToggleButton
            className="btn btn-lg comfortable-reply-button"
            aria-checked={comfortable === 'no'}
            value="no"
            bsStyle="default"
            bsSize="large"
          >
            {t('No')}
          </ToggleButton>
          <ToggleButton
            className="btn btn-lg comfortable-reply-button"
            aria-checked={comfortable === 'unknown'}
            value="unknown"
            bsStyle="default"
            bsSize="large"
          >
            {t("I don't know")}
          </ToggleButton>
        </ToggleButtonGroup>

        {comfortable === 'no' && (
          <Report
            onChangeReport={onChangeReport}
            onChangeReportMessage={onChangeReportMessage}
            report={report}
            reportMessage={reportMessage}
          />
        )}
        <span className="help-block">
          {
            "This answer won't be shared with $username and is collected for safety reasons and aggregated analysis only. "
          }
          <a>Read more</a>
        </span>
      </div>
    </div>
  );
}

Experience.propTypes = {
  primaryInteraction: PropTypes.string.isRequired,
  comfortable: PropTypes.string,
  report: PropTypes.bool.isRequired,
  reportMessage: PropTypes.string.isRequired,
  onChangeRecommend: PropTypes.func.isRequired,
  onChangeReport: PropTypes.func.isRequired,
  onChangeReportMessage: PropTypes.func.isRequired,
};
