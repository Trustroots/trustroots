// Internal dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

// External dependencies
import { experienceType } from '@/modules/experiences/client/experiences.prop-types';
import Icon from '@/modules/core/client/components/Icon';
import type { Experience } from '../../experiences.prop-types';

const Summary = styled.div`
  margin: 20px 0;
`;

const SummarySentence = styled.p`
  margin-bottom: 10px;
`;

const SummaryIcon = styled(Icon).attrs(() => ({
  // Props are static here so that we don't need to repeat them later in the code
  className: 'text-muted',
  fixedWidth: true,
}))`
  margin-right: 7px;
`;

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

    return <SummarySentence className="lead">{summary}</SummarySentence>;
  };

  // Details about recommendations.
  const renderRecommendationStats = () => {
    const summaries: string[] = [];

    if (totalCount === recommendCount) {
      summaries.push(t('Everyone recommends them.') as string);
    }

    if (totalCount === nonRecommendCount) {
      summaries.push(
        t('Everyone said they would not recommend them.') as string,
      );
    }

    if (totalCount !== nonRecommendCount && nonRecommendCount > 0) {
      summaries.push(
        t('{{count}} did not recommend.', {
          count: nonRecommendCount,
        }) as string,
      );
    }

    if (totalCount !== recommendCount && recommendCount > 0) {
      summaries.push(
        t('{{count}} recommended them.', {
          count: recommendCount,
        }) as string,
      );
    }

    return summaries.length > 0 ? (
      <p>
        <SummaryIcon
          icon={nonRecommendCount > 0 ? 'close' : 'ok'}
          size={undefined}
        />
        {summaries.join(' ')}
      </p>
    ) : null;
  };

  // Statistics about "met", "host", "guest" interactions.
  const renderInteractionStats = () => {
    const interactions: string[] = [];

    const getInteractionPercentage = (
      interaction: keyof NonNullable<Experience['interactions']>,
    ): number => {
      const count = experiences.filter(({ interactions }) =>
        Boolean(interactions?.[interaction]),
      ).length;

      return parseInt(String((count / totalCount) * 100), 10);
    };

    const metPercentage = getInteractionPercentage('met');
    const experiencesFromGuestsPercentage = getInteractionPercentage('guest');
    const experiencesFromHostsPercentage = getInteractionPercentage('host');

    if (experiencesFromHostsPercentage === 100) {
      interactions.push(t('Was hosted by everyone.') as string);
    } else if (experiencesFromHostsPercentage > 0) {
      interactions.push(
        t('Was hosted by {{percentage}}% of members.', {
          percentage: experiencesFromHostsPercentage,
        }) as string,
      );
    }

    if (experiencesFromGuestsPercentage === 100) {
      interactions.push(t('They hosted everyone.') as string);
    } else if (experiencesFromGuestsPercentage > 0) {
      interactions.push(
        t('They hosted {{percentage}}% of members.', {
          percentage: experiencesFromGuestsPercentage,
        }) as string,
      );
    }

    if (metPercentage === 0) {
      interactions.push(t('Did not meet with anyone.') as string);
    } else if (metPercentage === 100) {
      interactions.push(t('Met with everyone.') as string);
    } else {
      interactions.push(
        t('Met with {{percentage}}% of members.', {
          percentage: metPercentage,
        }) as string,
      );
    }

    return (
      <p>
        <SummaryIcon icon="tree" size={undefined} />
        {interactions.join(' ')}
      </p>
    );
  };

  // Statistics about genders
  const renderGenderStats = () => {
    const getGenderPercentage = (value: string): number => {
      const count = experiences.filter(
        ({ userFrom: { gender } }) => gender === value,
      ).length;

      return parseInt(String((count / totalCount) * 100), 10);
    };

    const females = getGenderPercentage('female');
    const males = getGenderPercentage('male');

    let genderSummary: string | undefined;
    let genderIcon = 'user';

    if (females === 100) {
      genderSummary = t('All experiences are by female members.') as string;
    } else if (males === 100) {
      genderSummary = t('All experiences are by male members.') as string;
    } else if (females > 0 && males > 0) {
      genderIcon = 'users'; // Plural instead of singular
      genderSummary = t(
        '{{percentageFemales}}% of experiences are by females, and {{percentageMales}}% are by males.',
        {
          percentageFemales: females,
          percentageMales: males,
        },
      ) as string;
    } else if (females > 0) {
      genderSummary = t(
        '{{percentage}}% of experiences are by female members.',
        {
          percentage: females,
        },
      ) as string;
    } else if (males > 0) {
      genderSummary = t('{{percentage}}% of experiences are by male members.', {
        percentage: males,
      }) as string;
    }

    return genderSummary ? (
      <p>
        <SummaryIcon icon={genderIcon} size={undefined} />
        {genderSummary}
      </p>
    ) : null;
  };

  return (
    <Summary>
      {renderSummarySentence()}
      {totalCount > 1 && renderRecommendationStats()}
      {totalCount > 2 && renderGenderStats()}
      {totalCount > 1 && renderInteractionStats()}
    </Summary>
  );
}

ExperienceCounts.propTypes = {
  experiences: PropTypes.arrayOf(experienceType).isRequired,
};
