import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { useTranslation } from 'react-i18next';
import styled, { css } from 'styled-components';

import JoinButton from './JoinButton';

import { getCircleBackgroundStyle } from '../utils';
import type { MembershipUpdate, TribeSummary } from '../api/tribes.api';
import type { UserProfile } from '@/modules/users/client/types';

const Container = styled.div.attrs({
  className: 'panel tribe tribe-image',
})<{ tribe: TribeSummary }>`
  // the following styles should have high specificity
  // https://www.styled-components.com/docs/faqs#how-can-i-override-styles-with-higher-specificity
  &&& {
    position: relative;
    ${({ tribe }) => {
      const style = getCircleBackgroundStyle(tribe, '742x496');
      return css`
        ${style.backgroundImage
          ? `background-image: ${style.backgroundImage};`
          : ''}
        ${style.backgroundColor
          ? `background-color: ${style.backgroundColor};`
          : ''}
      `;
    }}
  }
`;

export default function Tribe({
  tribe,
  user,
  onMembershipUpdated,
}: {
  tribe: TribeSummary;
  user?: UserProfile;
  onMembershipUpdated: (data: MembershipUpdate) => void;
}) {
  const { t } = useTranslation('circles') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  const countInfo: string =
    tribe.count === 0
      ? (t('No members yet') as string)
      : (t('{{count, number}} members', { count: tribe.count }) as string);

  return (
    <Container tribe={tribe}>
      <a href={`/circles/${tribe.slug}`} className="tribe-link">
        {tribe.new && (
          <span className="tribe-new" aria-hidden={true}>
            <span className="label label-primary">
              {t('New circle!') as string}
            </span>
          </span>
        )}
        <div
          className={classnames('tribe-content', {
            'is-image': tribe.image,
          })}
        >
          <h3 className="font-brand-light tribe-label">{tribe.label}</h3>
          <span className="tribe-meta">{countInfo}</span>
        </div>
      </a>
      <div className="tribe-actions">
        {tribe && (
          <JoinButton
            tribe={tribe}
            user={user}
            icon={true}
            onUpdated={onMembershipUpdated}
          />
        )}
      </div>
    </Container>
  );
}

Tribe.propTypes = {
  tribe: PropTypes.object.isRequired,
  user: PropTypes.object,
  onMembershipUpdated: PropTypes.func.isRequired,
};
