import React from 'react';
import PropTypes from 'prop-types';
import '@/config/client/i18n';
import { withTranslation } from 'react-i18next';

const Report = withTranslation('reference')(function ({ t, report, reportMessage, onChangeReport, onChangeReportMessage }) {
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
            checked={report}
            onChange={onChangeReport}
          />
          {t('Report this person to moderators')}
        </label>
      </div>
      {report && (
        <div>
          <label htmlFor="report-message" className="control-label">{t('Message to moderators')}</label>
          <textarea className="form-control input-lg"
            rows="7"
            id="report-message"
            onChange={(event) => onChangeReportMessage(event.target.value)}
            value={reportMessage}
          ></textarea>
          <span className="help-block">
            {t('Please write in English if possible.')}<br />
          </span>
        </div>
      )}
    </div>
  );
});

Report.propTypes = {
  report: PropTypes.bool.isRequired,
  reportMessage: PropTypes.string.isRequired,
  onChangeReport: PropTypes.func.isRequired,
  onChangeReportMessage: PropTypes.func.isRequired
};

export default Report;
