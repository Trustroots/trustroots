import { useTranslation } from 'react-i18next';
import React from 'react';
import { Badge } from '@trustroots/ui/Badge';
import { Button } from '@trustroots/ui/Button';
import { cn } from '@trustroots/ui/cn';

import type {
  ExperienceInteractions,
  ExperienceRecommendation,
} from '../../../shared/experience';

export type ExperienceTag =
  keyof ExperienceInteractions | Exclude<ExperienceRecommendation, 'unknown'>;

export type ExperienceTagFilters = {
  interaction: keyof ExperienceInteractions | '';
  recommendation: ExperienceRecommendation | '';
  toggle: (tag: ExperienceTag) => void;
};

export default function Meta({
  interactions,
  recommend,
  tagFilters,
}: {
  interactions?: ExperienceInteractions;
  recommend?: ExperienceRecommendation;
  tagFilters?: ExperienceTagFilters;
}) {
  const { t } = useTranslation('experiences') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  return (
    <div
      className={cn(
        'tw:flex tw:flex-wrap tw:items-center tw:gap-[5px] tw:py-2.5',
        tagFilters &&
          'tw:justify-end tw:[@media(max-width:480px)]:justify-start',
      )}
    >
      {(
        [
          ['yes', recommend === 'yes', t('Recommend')],
          ['no', recommend === 'no', t('Not recommend')],
          ['guest', interactions?.guest, t('Guest')],
          ['host', interactions?.host, t('Host')],
          ['met', interactions?.met, t('Met in person')],
        ] as const
      )
        .filter(([, visible]) => visible)
        .map(([tag, , label]) => {
          if (!tagFilters) {
            return (
              <Badge key={tag} variant="solid" intent="neutral">
                {label}
              </Badge>
            );
          }

          const selected =
            tag === tagFilters.interaction || tag === tagFilters.recommendation;
          return (
            <Button
              key={tag}
              type="button"
              size="xs"
              variant="soft"
              intent={selected ? 'primary' : 'neutral'}
              aria-label={t('Filter by {{tag}}', { tag: label })}
              aria-pressed={selected}
              onClick={() => tagFilters.toggle(tag)}
            >
              {label}
            </Button>
          );
        })}
    </div>
  );
}
