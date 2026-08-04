import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import { getCircleBackgroundStyle } from '@/modules/tribes/client/utils';

function TribeBadge({ membership }) {
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

TribeBadge.propTypes = {
  membership: PropTypes.object.isRequired,
};

export default function MembershipsList({ memberships = [], isOwnProfile }) {
  const { t } = useTranslation('users');
  const [limit, setLimit] = useState(5);

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
            <button
              type="button"
              className="panel-more-fade btn btn-link"
              onClick={() => setLimit(undefined)}
            >
              {t('Show more...')}
            </button>
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
              <a href="/circles" className="btn btn-primary">
                {t('Join circles')}
              </a>
            </div>
          )}
          {sortedMemberships.length > 0 && (
            <div>
              <hr className="hr-gray hr-tight" />
              <a href="/circles" className="btn btn-sm btn-default">
                {t('Join more circles')}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

MembershipsList.propTypes = {
  isOwnProfile: PropTypes.bool.isRequired,
  memberships: PropTypes.array,
};
