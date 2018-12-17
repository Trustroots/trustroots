import React from 'react';
import PropTypes from 'prop-types';
import Report from './Report';
import { ToggleButton, ToggleButtonGroup } from 'react-bootstrap';

export default function Recommend({ primaryInteraction, recommend, report, reportMessage, onChangeRecommend, onChangeReport, onChangeReportMessage }) {

  const recommendQuestions = {
    hostedMe: 'Would you recommend others to stay with them?',
    hostedThem: 'Would you recommend others to host them?',
    met: 'Would you recommend others to meet them?'
  };

  const question = recommendQuestions[primaryInteraction];

  return (
    <div className="panel panel-default">
      <div className="panel-heading" ng-switch="referenceNew.recommendationQuestion" id="recommendationQuestion">
        <h4>{question}</h4>
      </div>
      <div className="panel-body">
        <ToggleButtonGroup
          type="radio"
          name="recommend"
          onChange={onChangeRecommend}
          value={recommend}
          aria-labelledby="recommendationQuestion">
          <ToggleButton
            className="btn btn-lg"
            aria-checked={ recommend === 'yes' }
            value="yes"
            bsStyle="success"
            bsSize="large"
          >
            Yes
          </ToggleButton>
          <ToggleButton
            className="btn btn-lg"
            aria-checked={ recommend === 'no' }
            value="no"
            bsStyle="danger"
            bsSize="large"
          >
            No
          </ToggleButton>
          <ToggleButton
            aria-checked={recommend === 'unknown' }
            value="unknown"
            bsStyle="default"
            bsSize="large"
          >
            I don&apos;t know
          </ToggleButton>
        </ToggleButtonGroup>
        {recommend === 'no' && (
          <Report
            onChangeReport={onChangeReport}
            onChangeReportMessage={onChangeReportMessage}
            report={report}
            reportMessage={reportMessage}
          />
        )}
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
  onChangeReportMessage: PropTypes.func.isRequired
};
