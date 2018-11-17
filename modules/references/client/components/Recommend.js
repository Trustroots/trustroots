import React from 'react';
import PropTypes from 'prop-types';
import Report from './Report';

export default function Recommend(props) {

  const { hostedMe, hostedThem } = props.reference.interactions;
  const maxInteraction = (hostedMe) ? 'hostedMe' : (hostedThem) ? 'hostedThem' : 'met';
  const recommendQuestions = {
    hostedMe: 'Would you recommend others to stay with them?',
    hostedThem: 'Would you recommend others to host them?',
    met: 'Would you recommend others to meet them?'
  };
  const question = recommendQuestions[maxInteraction];

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
            aria-checked={ props.reference.recommend === 'yes' }>
            <input
              type="radio"
              name="recommend"
              checked={props.reference.recommend === 'yes'}
              onChange={() => props.onChangeRecommend('yes')}
            />
            <span>Yes</span>
          </label>
          <label className="btn btn-lg btn-reference-recommend btn-reference-recommend-no"
            role="radio"
            aria-checked={ props.reference.recommend === 'no' }>
            <input
              type="radio"
              name="recommend"
              checked={props.reference.recommend === 'no'}
              onChange={() => props.onChangeRecommend('no')}
            />
            <span>No</span>
          </label>
          <label className="btn btn-lg btn-reference-recommend btn-reference-recommend-unknown"
            role="radio"
            aria-checked={props.reference.recommend === 'unknown' }>
            <input
              type="radio"
              name="recommend"
              checked={props.reference.recommend === 'unknown'}
              onChange={() => props.onChangeRecommend('unknown')}
            />
            <span>I don&apos;t know</span>
          </label>
        </div>
        {(!props.reference.recommend) ?
          <div className="alert alert-warning reference-new-tabs-alert" role="alert" ng-if="!referenceNew.reference.recommend && referenceNew.recommendationWarning">
            Please choose if you can recommend them.
          </div> : null}
        {(props.reference.recommend === 'no') ?
          <Report
            onChangeReport={props.onChangeReport}
            onChangeReportMessage={props.onChangeReportMessage}
            report={props.report}
            reportMessage={props.reportMessage}
          /> : null}
      </div>
    </div>
  );
}

Recommend.propTypes = {
  reference: PropTypes.object,
  onChangeRecommend: PropTypes.func,
  onChangeReport: PropTypes.func,
  onChangeReportMessage: PropTypes.func,
  report: PropTypes.bool,
  reportMessage: PropTypes.string
};
