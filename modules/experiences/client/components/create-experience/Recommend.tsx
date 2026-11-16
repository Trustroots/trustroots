// External dependencies
import { ToggleGroup, ToggleGroupItem } from '@trustroots/ui/ToggleGroup';
import { useTranslation } from 'react-i18next';
import React from 'react';

// Internal dependencies
import '@/config/client/i18n';
import Report from './Report';
import type { ExperienceRecommendation } from '../../../shared/experience';

type PrimaryInteraction = 'guest' | 'host' | 'met';

interface RecommendProps {
  primaryInteraction: PrimaryInteraction;
  recommend: ExperienceRecommendation | null;
  report: boolean;
  reportMessage: string;
  onChangeRecommend: (recommend: ExperienceRecommendation) => void;
  onChangeReport: () => void;
  onChangeReportMessage: (message: string) => void;
}

export default function Recommend({
  primaryInteraction,
  recommend,
  report,
  reportMessage,
  onChangeRecommend,
  onChangeReport,
  onChangeReportMessage,
}: RecommendProps) {
  const { t } = useTranslation('experiences') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  const recommendQuestions: Record<PrimaryInteraction, string> = {
    guest: t(
      'Besides your personal experience, would you recommend others to stay with them?',
    ) as string,
    host: t(
      'Besides your personal experience, would you recommend others to host them?',
    ) as string,
    met: t(
      'Besides your personal experience, would you recommend others to meet them?',
    ) as string,
  };

  return (
    <div className="panel panel-default">
      <div className="panel-heading">
        <h4 id="would-you-recommend-them-question">
          {recommendQuestions[primaryInteraction]}
        </h4>
      </div>
      <div className="panel-body">
        <ToggleGroup
          name="recommend"
          onValueChange={onChangeRecommend}
          value={recommend}
          aria-labelledby="would-you-recommend-them-question"
        >
          <ToggleGroupItem value="yes">{t('Yes') as string}</ToggleGroupItem>
          <ToggleGroupItem value="no">{t('No') as string}</ToggleGroupItem>
          <div className="tw:float-start tw:mx-[5px] tw:mt-3 tw:inline-block tw:h-5 tw:w-px tw:bg-[#ccc]" />
          <ToggleGroupItem value="unknown">
            {t('Skip') as string}
          </ToggleGroupItem>
        </ToggleGroup>
        {recommend === 'no' && (
          <div className="lead tw:my-[30px]">
            {
              t(
                "We're sad to hear you didn't have a great experience using Trustroots!",
              ) as string
            }
            {' 😞'}
          </div>
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
