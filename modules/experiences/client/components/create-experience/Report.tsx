// External dependencies
import { useTranslation } from 'react-i18next';
import React from 'react';

// Internal dependencies
import '@/config/client/i18n';
import { Textarea } from '@trustroots/ui/Textarea';

interface ReportProps {
  onChangeReport: () => void;
  onChangeReportMessage: (message: string) => void;
  report: boolean;
  reportMessage: string;
}

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
    <div className="tw:mt-[50px]">
      <p>
        {
          t(
            'You can send a separate private report if you have a safety concern or someone broke the community rules.',
          ) as string
        }
      </p>
      <label className="tw:flex tw:items-start tw:gap-2 tw:text-inherit">
        <input
          type="checkbox"
          checked={report}
          onChange={onChangeReport}
          className="tw:mt-1"
        />
        {t('Privately report this person to the moderators') as string}
      </label>
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
          <Textarea
            rows={7}
            id="report-message"
            onChange={event => onChangeReportMessage(event.target.value)}
            value={reportMessage}
          />
          <span className="help-block">
            {t('Please write in English if possible, thank you.') as string}
            <br />
          </span>
        </>
      )}
    </div>
  );
}
