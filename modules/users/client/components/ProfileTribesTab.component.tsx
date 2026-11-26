import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ProfileCircles } from '../member-circles';
import type { TribeMembership, UserProfile } from '../types';
import type { ProfileTribe } from '../../shared/profile';

type CircleDisplay = Pick<
  ProfileCircles,
  'getCircleBackgroundStyle' | 'JoinButton'
>;

type Membership = TribeMembership;
type MembershipUpdated = (data: { user?: UserProfile } | null) => void;

function TribeCard({
  circles: { getCircleBackgroundStyle, JoinButton },
  membership,
  user,
  onMembershipUpdated,
}: {
  circles: CircleDisplay;
  membership: Membership;
  user?: UserProfile;
  onMembershipUpdated?: MembershipUpdated;
}) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const tribe: ProfileTribe = {
    _id: membership.tribe._id,
    slug: membership.tribe.slug,
    label: membership.tribe.label,
    count: membership.tribe.count,
    ...(membership.tribe.color === undefined
      ? {}
      : { color: membership.tribe.color }),
    ...(membership.tribe.image === undefined
      ? {}
      : { image: membership.tribe.image }),
  };
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
          {user && membership.joinReason && (
            <p className="tribe-join-reason">{membership.joinReason}</p>
          )}
          <JoinButton
            look={{ size: 'xs', intent: 'primary' }}
            onUpdated={onMembershipUpdated}
            source="profile"
            tribe={tribe}
            user={user}
          />
        </div>
      </a>
    </li>
  );
}

export default function ProfileTribesTab({
  circles,
  memberships = [],
  user,
  onMembershipUpdated,
}: {
  circles: CircleDisplay;
  memberships?: Membership[];
  user?: UserProfile;
  onMembershipUpdated?: MembershipUpdated;
}) {
  return (
    <div className="tw:grid-row">
      <div className="tw:md:grid-col-12">
        <ul className="tribes-grid">
          {memberships.map(membership => (
            <TribeCard
              key={membership.tribe._id}
              circles={circles}
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
