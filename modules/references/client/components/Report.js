import React from 'react';
import PropTypes from 'prop-types';

export default function Report(props) {
  return (
    <div>
      <br /><br />
      <p className="lead">
        We&apos;re sad to hear you didn&apos;t have great experience using Trustroots! 😞
      </p>
      <label>
        <input
          type="checkbox"
          checked={props.report}
          onChange={props.onChangeReport}
        />
        Report this person to moderators
      </label>
      <br /><br />
      {(props.report) ?
        <div>
          <label htmlFor="report-message" className="control-label">Message to moderators</label>
          <textarea className="form-control input-lg"
            rows="7"
            id="message"
            onChange={(event) => props.onChangeReportMessage(event.target.value)}
            value={props.reportMessage}
          ></textarea>
          <span className="help-block">
            Please write in English if possible.<br />
          </span>
        </div> : null
      }
    </div>
  );
}

Report.propTypes = {
  report: PropTypes.bool.isRequired,
  reportMessage: PropTypes.string.isRequired,
  onChangeReport: PropTypes.func.isRequired,
  onChangeReportMessage: PropTypes.func.isRequired
};
