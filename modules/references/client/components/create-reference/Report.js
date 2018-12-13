import React from 'react';
import PropTypes from 'prop-types';
import '@/config/lib/i18n';
import { withNamespaces } from 'react-i18next';

function Report(props) {
  const { t } = props;
  return (
    <div>
      <br /><br />
      <p className="lead">
        {t('We\'re sad to hear you didn\'t have a great experience using Trustroots!')} 😞
      </p>
      <div className="checkbox">
        <label>
          <input
            type="checkbox"
            checked={props.report}
            onChange={props.onChangeReport}
          />
          {t('Report this person to moderators')}
        </label>
      </div>
      {props.report && (
        <div>
          <label htmlFor="report-message" className="control-label">{t('Message to moderators')}</label>
          <textarea className="form-control input-lg"
            rows="7"
            id="message"
            onChange={(event) => props.onChangeReportMessage(event.target.value)}
            value={props.reportMessage}
          ></textarea>
          <span className="help-block">
            {t('Please write in English if possible.')}<br />
          </span>
        </div>
      )}
    </div>
  );
}

Report.propTypes = {
  report: PropTypes.bool.isRequired,
  reportMessage: PropTypes.string.isRequired,
  onChangeReport: PropTypes.func.isRequired,
  onChangeReportMessage: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired
};

export default withNamespaces('reference')(Report);
