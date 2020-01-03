import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { useTranslation } from 'react-i18next';

import JoinButton from './JoinButton';

import getTribeBackgroundStyle from './helpers/getTribeBackgroundStyle';

/**
 * @TODO maybe rename to Tribe
 */
export default function TribeItem({ tribe, user, onMembershipUpdated }) {
  const { t } = useTranslation('tribes');

  const countInfo = (tribe.count === 0)
    ? t('No members yet')
    : t('{{count, number}} members', { count: tribe.count });

  return <div
    className="panel tribe tribe-image"
    style={getTribeBackgroundStyle(tribe, { isProgressive: true, dimensions: '742x496' })}
  >
    <a href={`/tribes/${tribe.slug}`} className="tribe-link">
      {tribe.new && <span className="tribe-new" aria-hidden={true}>
        <span className="label label-primary">
          {t('New tribe!')}
        </span>
      </span>}
      <div className={classnames('tribe-content', tribe.image_UUID ? 'is-image' : '')}>
        <h3 className="font-brand-light tribe-label">{tribe.label}</h3>
        <span className="tribe-meta">{countInfo}</span>
      </div>
    </a>
    <div className="tribe-actions">
      {tribe && <JoinButton
        tribe={tribe}
        user={user}
        icon={true}
        onUpdated={onMembershipUpdated}
      />}
    </div>
  </div>;
}

TribeItem.propTypes = {
  tribe: PropTypes.object.isRequired,
  user: PropTypes.object,
  onMembershipUpdated: PropTypes.func.isRequired
};
