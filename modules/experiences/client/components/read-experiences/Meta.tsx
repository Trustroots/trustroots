import { useTranslation } from 'react-i18next';
import React from 'react';
import { Badge } from '@trustroots/ui/Badge';

import type {
  ExperienceInteractions,
  ExperienceRecommendation,
} from '../../../shared/experience';

export default function Meta({
  interactions,
  recommend,
}: {
  interactions?: ExperienceInteractions;
  recommend?: ExperienceRecommendation;
}) {
  const { t } = useTranslation('experiences') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:py-2.5 tw:*:me-[5px] tw:*:mb-[5px]">
      {[
        recommend === 'yes' && t('Recommend'),
        recommend === 'no' && t('Not recommend'),
        interactions?.guest && t('Guest'),
        interactions?.host && t('Host'),
        interactions?.met && t('Met in person'),
      ]
        .filter((label): label is string => typeof label === 'string')
        .map(label => (
          <Badge key={label} variant="solid" intent="neutral">
            {label}
          </Badge>
        ))}
    </div>
  );
}
