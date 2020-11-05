import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import JoinButton from './JoinButton';

import { getCircleBackgroundStyle } from '../utils';

const Container = styled.div.attrs({
  className: 'panel tribe tribe-image',
})`
  // the following styles should have high specificity
  // https://www.styled-components.com/docs/faqs#how-can-i-override-styles-with-higher-specificity
  &&& {
    position: relative;
    ${({ tribe }) => getCircleBackgroundStyle(tribe, '742x496')}
  }
`;

export default function Tribe({ tribe, user, onMembershipUpdated }) {
  const { t } = useTranslation('circles');

  const countInfo =
    tribe.count === 0
      ? t('No members yet')
      : t('{{count, number}} members', { count: tribe.count });

  return (
    <Container tribe={tribe}>
      <a href={`/circles/${tribe.slug}`} className="tribe-link">
        {tribe.new && (
          <span className="tribe-new" aria-hidden={true}>
            <span className="label label-primary">{t('New circle!')}</span>
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
