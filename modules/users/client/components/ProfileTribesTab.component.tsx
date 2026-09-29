import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import { getCircleBackgroundStyle } from '@/modules/tribes/client/utils';
import JoinButton from '@/modules/tribes/client/components/JoinButton';
import type { TribeMembership, UserProfile } from '../types';
import type { TribeSummary } from '@/modules/tribes/client/api/tribes.api';

type Membership = TribeMembership & { tribe: TribeSummary };
type MembershipUpdated = (data: { user?: UserProfile } | null) => void;

function TribeCard({
  membership,
  user,
  onMembershipUpdated,
}: {
  membership: Membership;
  user?: UserProfile;
  onMembershipUpdated?: MembershipUpdated;
}) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const tribe = membership.tribe;
  const countLabel =
    tribe.count === 0
      ? t('No members yet')
      : t('{{count, number}} members', { count: tribe.count });

  return (
    <li
      className="panel tribe tribe-image"
      style={getCircleBackgroundStyle(tribe, '300x300')}
    >
      <a href={`/circles/${tribe.slug}`} className="tribe-link">
        <div className={`tribe-content ${tribe.image ? 'is-image' : ''}`}>
          <h3 className="tribe-label">{tribe.label}</h3>
          <div className="tribe-meta">{countLabel}</div>
          <JoinButton
            className="btn btn-xs btn-primary"
            onUpdated={onMembershipUpdated}
            tribe={tribe}
            user={user}
          />
        </div>
      </a>
    </li>
  );
}

TribeCard.propTypes = {
  membership: PropTypes.object.isRequired,
  onMembershipUpdated: PropTypes.func,
  user: PropTypes.object,
};

export default function ProfileTribesTab({
  memberships = [],
  user,
  onMembershipUpdated,
}: {
  memberships?: Membership[];
  user?: UserProfile;
  onMembershipUpdated?: MembershipUpdated;
}) {
  return (
    <div className="row">
      <div className="col-md-12">
        <ul className="tribes-grid">
          {memberships.map(membership => (
            <TribeCard
              key={membership.tribe._id}
              membership={membership}
              onMembershipUpdated={onMembershipUpdated}
              user={user}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

ProfileTribesTab.propTypes = {
  memberships: PropTypes.array,
  onMembershipUpdated: PropTypes.func,
  user: PropTypes.object,
};
