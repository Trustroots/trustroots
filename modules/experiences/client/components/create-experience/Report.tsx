// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

// Internal dependencies
import '@/config/client/i18n';
import Switch from '@/modules/core/client/components/Switch';

interface ReportProps {
  onChangeReport: () => void;
  onChangeReportMessage: (message: string) => void;
  report: boolean;
  reportMessage: string;
}

const ReportContainer = styled.div`
  margin-top: 50px;
`;

export default function Report({
  onChangeReport,
  onChangeReportMessage,
  report,
  reportMessage,
}: ReportProps) {
  const { t } = useTranslation('experiences') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  return (
    <ReportContainer>
      <p>
        {
          t(
            "It's extremely important you report anyone behaving against community rules or values to us.",
          ) as string
        }
      </p>
      <Switch isSmall checked={report} onChange={onChangeReport}>
        {t('Privately report this person to the moderators') as string}
      </Switch>
      {report && (
        <>
          <p>
            {t(
              'Reporting this member lets our support team read your entire conversation and all experiences between you, including unpublished feedback. This access continues after the report is resolved.',
            )}
          </p>
          <br />
          <br />
          <label htmlFor="report-message" className="control-label">
            {t('Message to the moderators') as string}
          </label>
          <textarea
            className="form-control input-lg"
            rows={7}
            id="report-message"
            onChange={event => onChangeReportMessage(event.target.value)}
            value={reportMessage}
          ></textarea>
          <span className="help-block">
            {t('Please write in English if possible, thank you.') as string}
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
