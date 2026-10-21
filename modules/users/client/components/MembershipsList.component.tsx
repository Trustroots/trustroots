import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui';

import { getCircleBackgroundStyle } from '@/modules/tribes/client/utils';
import type { TribeMembership } from '../types';

function TribeBadge({ membership }: { membership: TribeMembership }) {
  const tribe = membership.tribe;

  return (
    <li className="tribe">
      <div className="tribe-badge">
        <div
          className="tribe-badge-image tribe-image"
          style={getCircleBackgroundStyle(tribe, '120x120')}
        >
          {!tribe.image && <span>{tribe.label.charAt(0)}</span>}
        </div>
        <div className="tribe-badge-info">
          <a className="tribe-badge-link" href={`/circles/${tribe.slug}`}>
            {tribe.label}
          </a>
          <br />
          <small className="text-muted">
            {tribe.count === 0
              ? 'No members yet'
              : `${tribe.count.toLocaleString()} members`}
          </small>
        </div>
      </div>
    </li>
  );
}

export default function MembershipsList({
  memberships = [],
  isOwnProfile,
}: {
  memberships?: TribeMembership[];
  isOwnProfile: boolean;
}) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const [limit, setLimit] = useState<number | undefined>(5);

  const sortedMemberships = useMemo(
    () =>
      [...memberships].sort(
        /* istanbul ignore next -- membership records always contain circle counts. */
        (left, right) => (right.tribe?.count || 0) - (left.tribe?.count || 0),
      ),
    [memberships],
  );

  const visibleMemberships = limit
    ? sortedMemberships.slice(0, limit)
    : sortedMemberships;

  return (
    <div>
      {sortedMemberships.length > 0 && (
        <ul className="profile-memberships-list panel-more-wrap">
          <div className="panel-more-excerpt">
            {visibleMemberships.map(membership => (
              <TribeBadge key={membership.tribe._id} membership={membership} />
            ))}
          </div>
          {limit && sortedMemberships.length > limit && (
            <Button
              type="button"
              variant="link"
              className="panel-more-fade"
              onClick={() => setLimit(undefined)}
            >
              {t('Show more...')}
            </Button>
          )}
        </ul>
      )}

      {isOwnProfile && (
        <div className="text-center">
          {sortedMemberships.length === 0 && (
            <div className="content-empty">
              <div className="icon-tribes icon-3x text-muted" />
              <p>
                <em>
                  {t(
                    'Joining circles helps you find likeminded Trustroots members.',
                  )}
                </em>
              </p>
              <br />
              <br />
              <Button as="a" href="/circles" variant="primary">
                {t('Join circles')}
              </Button>
            </div>
          )}
          {sortedMemberships.length > 0 && (
            <div>
              <hr className="hr-gray hr-tight" />
              <Button as="a" href="/circles" variant="default" size="sm">
                {t('Join more circles')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
