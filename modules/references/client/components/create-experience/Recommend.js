// External dependencies
import { ToggleButton, ToggleButtonGroup } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

// Internal dependencies
import '@/config/client/i18n';
import Report from './Report';

const SadNotice = styled.div`
  margin: 30px 0;
`;

export default function Recommend({
  primaryInteraction,
  recommend,
  report,
  reportMessage,
  onChangeRecommend,
  onChangeReport,
  onChangeReportMessage,
}) {
  const { t } = useTranslation('references');

  const recommendQuestions = {
    hostedMe: t('Would you recommend others to stay with them?'),
    hostedThem: t('Would you recommend others to host them?'),
    met: t('Would you recommend others to meet them?'),
  };

  const question = recommendQuestions[primaryInteraction];

  return (
    <div className="panel panel-default">
      <div className="panel-heading">
        <h4 id="would-you-recommend-them-question">{question}</h4>
      </div>
      <div className="panel-body">
        <ToggleButtonGroup
          type="radio"
          name="recommend"
          onChange={onChangeRecommend}
          value={recommend}
          aria-labelledby="would-you-recommend-them-question"
        >
          <ToggleButton
            className="btn btn-lg"
            aria-checked={recommend === 'yes'}
            value="yes"
            bsStyle="default"
            bsSize="large"
          >
            {t('Yes')}
          </ToggleButton>
          <ToggleButton
            className="btn btn-lg"
            aria-checked={recommend === 'no'}
            value="no"
            bsStyle="default"
            bsSize="large"
          >
            {t('No')}
          </ToggleButton>
          <ToggleButton
            aria-checked={recommend === 'unknown'}
            value="unknown"
            bsStyle="default"
            bsSize="large"
          >
            {t("I don't know")}
          </ToggleButton>
        </ToggleButtonGroup>
        {recommend === 'no' && (
          <SadNotice className="lead">
            {t(
              "We're sad to hear you didn't have a great experience using Trustroots!",
            )}
            {' 😞'}
            <br />
            {t(
              "It's extremely important you report anyone behaving against rules to us.",
            )}
          </SadNotice>
        )}
        <Report
          onChangeReport={onChangeReport}
          onChangeReportMessage={onChangeReportMessage}
          report={report}
          reportMessage={reportMessage}
        />
      </div>
    </div>
  );
}

Recommend.propTypes = {
  primaryInteraction: PropTypes.string.isRequired,
  recommend: PropTypes.string,
  report: PropTypes.bool.isRequired,
  reportMessage: PropTypes.string.isRequired,
  onChangeRecommend: PropTypes.func.isRequired,
  onChangeReport: PropTypes.func.isRequired,
  onChangeReportMessage: PropTypes.func.isRequired,
};
