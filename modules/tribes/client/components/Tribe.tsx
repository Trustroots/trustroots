import React from 'react';
import { cn } from '@trustroots/ui/cn';
import { useTranslation } from 'react-i18next';
import { Badge } from '@trustroots/ui/Badge';

import JoinButton from './JoinButton';

import { getCircleBackgroundStyle } from '../utils';
import type { MembershipUpdate, TribeSummary } from '../api/tribes.api';
import type { UserProfile } from '@/modules/users/client/types';

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
    <div
      className="panel tribe tribe-image tw:relative"
      style={getCircleBackgroundStyle(tribe, '742x496')}
    >
      <a href={`/circles/${tribe.slug}`} className="tribe-link">
        {tribe.new && (
          <span className="tribe-new" aria-hidden={true}>
            <Badge variant="solid" intent="primary">
              {t('New circle!') as string}
            </Badge>
          </span>
        )}
        <div
          className={cn('tribe-content', {
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
            source="circles_list"
            onUpdated={onMembershipUpdated}
          />
        )}
      </div>
    </div>
  );
}
