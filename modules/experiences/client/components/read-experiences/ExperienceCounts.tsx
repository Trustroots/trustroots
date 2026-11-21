// Internal dependencies
import { useTranslation } from 'react-i18next';
import React from 'react';

// External dependencies
import Icon from '@/modules/core/client/components/Icon';
import type { Experience } from '../../../shared/experience';

// NOTE: The array of `experiences` are all experiences where the user being
// displayed is in the `userTo` field of the experience. So they are experience
// reports left about the user.
export default function ExperienceCounts({
  experiences,
}: {
  experiences: Experience[];
}) {
  const { t } = useTranslation('experiences') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  const totalCount = experiences.length;

  const recommendCount = experiences.filter(
    ({ recommend }) => recommend === 'yes',
  ).length;

  const nonRecommendCount = experiences.filter(
    ({ recommend }) => recommend === 'no',
  ).length;

  // One sentence summary about experiences.
  const renderSummarySentence = () => {
    let summary: string;

    if (totalCount === 1 && recommendCount === 1) {
      summary = t(
        'One member shared their experience and they recommended them.',
      ) as string;
    } else if (totalCount === 1 && nonRecommendCount === 1) {
      summary = t(
        'One member shared their experience and they would not recommend them.',
      ) as string;
    } else {
      // Singular format comes from i18n-next translation files
      summary = t('{{count}} members shared their experiences.', {
        count: totalCount,
      }) as string;
    }

    return <p className="lead tw:mb-2.5">{summary}</p>;
  };

  // Details about recommendations.
  const renderRecommendationStats = () => {
    const summaries: string[] = [];
    const unanswered = totalCount - recommendCount - nonRecommendCount;

    if (nonRecommendCount > 0) {
      summaries.push(
        t('{{count}} did not recommend.', {
          count: nonRecommendCount,
        }) as string,
      );
    }

    if (recommendCount > 0) {
      summaries.push(
        t('{{count}} recommended them.', {
          count: recommendCount,
        }) as string,
      );
    }

    if (unanswered > 0) {
      summaries.push(
        t(
          'No recommendation recorded in {{count}} of {{total}} public experiences.',
          {
            count: unanswered,
            total: totalCount,
          },
        ),
      );
    }

    return (
      <p>
        <Icon
          className="text-muted tw:me-[7px]"
          fixedWidth
          icon="users"
          size={undefined}
        />
        {summaries.join(' ')}
      </p>
    );
  };

  // Statistics about "met", "host", "guest" interactions.
  const renderInteractionStats = () => {
    const interactions: string[] = [];

    const getInteractionCount = (
      interaction: keyof NonNullable<Experience['interactions']>,
    ) =>
      experiences.filter(({ interactions: answer }) => answer?.[interaction])
        .length;

    const met = getInteractionCount('met');
    const guests = getInteractionCount('guest');
    const hosts = getInteractionCount('host');
    const unanswered = experiences.filter(
      ({ interactions: answer }) =>
        !answer?.met && !answer?.guest && !answer?.host,
    ).length;

    if (hosts > 0) {
      interactions.push(
        t('{{count}} reported hosting them.', { count: hosts }),
      );
    }

    if (guests > 0) {
      interactions.push(
        t('{{count}} reported staying with them.', { count: guests }),
      );
    }

    if (met > 0) {
      interactions.push(
        t('{{count}} reported meeting them in person.', { count: met }),
      );
    }

    if (unanswered > 0) {
      interactions.push(
        t(
          'No interaction recorded in {{count}} of {{total}} public experiences.',
          {
            count: unanswered,
            total: totalCount,
          },
        ),
      );
    }

    return (
      <p>
        <Icon
          className="text-muted tw:me-[7px]"
          fixedWidth
          icon="tree"
          size={undefined}
        />
        {interactions.join(' ')}
      </p>
    );
  };

  // Statistics about genders
  const renderGenderStats = () => {
    const countGender = (value: string) =>
      experiences.filter(({ userFrom }) => userFrom.gender === value).length;
    const females = countGender('female');
    const males = countGender('male');
    if (!females && !males) return null;

    const summaries: string[] = [];
    if (females > 0) {
      summaries.push(t('{{count}} from female members.', { count: females }));
    }
    if (males > 0) {
      summaries.push(t('{{count}} from male members.', { count: males }));
    }
    const other = totalCount - females - males;
    if (other > 0) {
      summaries.push(
        t('{{count}} from members with another or unlisted gender.', {
          count: other,
        }),
      );
    }

    return (
      <p>
        <Icon
          className="text-muted tw:me-[7px]"
          fixedWidth
          icon="users"
          size={undefined}
        />
        {summaries.join(' ')}
      </p>
    );
  };

  return (
    <div className="tw:my-5">
      {renderSummarySentence()}
      {totalCount > 1 && renderRecommendationStats()}
      {totalCount > 2 && renderGenderStats()}
      {totalCount > 1 && renderInteractionStats()}
    </div>
  );
}
