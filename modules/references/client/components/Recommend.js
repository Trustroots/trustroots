import React from 'react';
import PropTypes from 'prop-types';
import Report from './Report';

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
        <div className="btn-group"
          role="radiogroup"
          aria-labelledby="recommendationQuestion">
          <label className="btn btn-lg btn-reference-recommend btn-reference-recommend-yes"
            role="radio"
            aria-checked={ recommend === 'yes' }>
            <input
              type="radio"
              name="recommend"
              checked={recommend === 'yes'}
              onChange={() => onChangeRecommend('yes')}
            />
            <span>Yes</span>
          </label>
          <label className="btn btn-lg btn-reference-recommend btn-reference-recommend-no"
            role="radio"
            aria-checked={ recommend === 'no' }>
            <input
              type="radio"
              name="recommend"
              checked={recommend === 'no'}
              onChange={() => onChangeRecommend('no')}
            />
            <span>No</span>
          </label>
          <label className="btn btn-lg btn-reference-recommend btn-reference-recommend-unknown"
            role="radio"
            aria-checked={recommend === 'unknown' }>
            <input
              type="radio"
              name="recommend"
              checked={recommend === 'unknown'}
              onChange={() => onChangeRecommend('unknown')}
            />
            <span>I don&apos;t know</span>
          </label>
        </div>
        {!recommend && (
          <div className="alert alert-warning reference-new-tabs-alert" role="alert" ng-if="!referenceNew.reference.recommend && referenceNew.recommendationWarning">
            Please choose if you can recommend them.
          </div>
        )}
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
