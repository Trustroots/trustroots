// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

// Internal dependencies
import '@/config/client/i18n';
import Switch from '@/modules/core/client/components/Switch';

const ReportContainer = styled.div`
  margin-top: 50px;
`;

export default function Report({
  onChangeReport,
  onChangeReportMessage,
  report,
  reportMessage,
}) {
  const { t } = useTranslation('experiences');

  return (
    <ReportContainer>
      <p>
        {t(
          "It's extremely important you report anyone behaving against community rules or values to us.",
        )}
      </p>
      <Switch isSmall checked={report} onChange={onChangeReport}>
        {t('Privately report this person to the moderators')}
      </Switch>
      {report && (
        <>
          <br />
          <br />
          <label htmlFor="report-message" className="control-label">
            {t('Message to the moderators')}
          </label>
          <textarea
            className="form-control input-lg"
            rows="7"
            id="report-message"
            onChange={event => onChangeReportMessage(event.target.value)}
            value={reportMessage}
          ></textarea>
          <span className="help-block">
            {t('Please write in English if possible, thank you.')}
            <br />
          </span>
        </>
      )}
    </ReportContainer>
  );
}

Report.propTypes = {
  report: PropTypes.bool.isRequired,
  reportMessage: PropTypes.string.isRequired,
  onChangeReport: PropTypes.func.isRequired,
  onChangeReportMessage: PropTypes.func.isRequired,
};
