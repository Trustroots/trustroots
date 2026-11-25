import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  Experience,
  ExperienceInteractions,
  ExperienceRecommendation,
} from '../../../shared/experience';
import type { ExperienceTag, ExperienceTagFilters } from './Meta';

type Interaction = keyof ExperienceInteractions;
type InteractionFilter = Interaction | '';
type RecommendationFilter = ExperienceRecommendation | '';

const selectClassName =
  'tw:block tw:w-full tw:rounded-md tw:border tw:border-solid tw:border-gray-300 tw:bg-white tw:px-2 tw:py-1.5';

export default function PublicExperiencesList({
  experiences,
  children,
}: {
  experiences: Experience[];
  children: (
    filtered: Experience[],
    tagFilters: ExperienceTagFilters,
  ) => React.ReactNode;
}) {
  const { t } = useTranslation('experiences');
  const [interaction, setInteraction] = useState<InteractionFilter>('');
  const [recommendation, setRecommendation] =
    useState<RecommendationFilter>('');
  const [oldestFirst, setOldestFirst] = useState(false);

  const filtered = experiences.filter(
    experience =>
      (!interaction || experience.interactions?.[interaction]) &&
      (!recommendation ||
        (experience.recommend ?? 'unknown') === recommendation),
  );
  if (oldestFirst) filtered.reverse();

  function toggleTag(tag: ExperienceTag) {
    if (tag === 'yes' || tag === 'no') {
      setRecommendation(current => (current === tag ? '' : tag));
    } else {
      setInteraction(current => (current === tag ? '' : tag));
    }
  }

  const tagFilters = { interaction, recommendation, toggle: toggleTag };
  if (experiences.length === 0) return children(filtered, tagFilters);

  return (
    <>
      <div
        role="group"
        aria-label={t('Public experience filters')}
        className="tw:mb-4 tw:grid tw:gap-3 tw:sm:grid-cols-3"
      >
        <label className="tw:text-inherit">
          {t('Interaction')}
          <select
            className={selectClassName}
            value={interaction}
            onChange={event =>
              setInteraction(event.target.value as InteractionFilter)
            }
          >
            <option value="">{t('All interactions')}</option>
            <option value="met">{t('Met in person')}</option>
            <option value="host">{t('Host')}</option>
            <option value="guest">{t('Guest')}</option>
          </select>
        </label>
        <label className="tw:text-inherit">
          {t('Recommendation')}
          <select
            className={selectClassName}
            value={recommendation}
            onChange={event =>
              setRecommendation(event.target.value as RecommendationFilter)
            }
          >
            <option value="">{t('All recommendations')}</option>
            <option value="yes">{t('Recommend')}</option>
            <option value="no">{t('Not recommend')}</option>
            <option value="unknown">{t('No recommendation')}</option>
          </select>
        </label>
        <label className="tw:text-inherit">
          {t('Sort by date')}
          <select
            className={selectClassName}
            value={oldestFirst ? 'oldest' : 'newest'}
            onChange={event => setOldestFirst(event.target.value === 'oldest')}
          >
            <option value="newest">{t('Newest first')}</option>
            <option value="oldest">{t('Oldest first')}</option>
          </select>
        </label>
      </div>
      <p role="status">
        {filtered.length === 0
          ? t('No public experiences match these filters.')
          : t('Showing {{shown}} of {{total}} public experiences.', {
              shown: filtered.length,
              total: experiences.length,
            })}
      </p>
      {children(filtered, tagFilters)}
    </>
  );
}
