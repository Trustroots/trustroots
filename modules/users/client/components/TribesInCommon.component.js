import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

export default function TribesInCommon({ memberships = [], memberIds = [] }) {
  const { t } = useTranslation('users');

  const commonMemberships = useMemo(
    () =>
      memberships.filter(
        membership =>
          membership.tribe && memberIds.includes(membership.tribe._id),
      ),
    [memberIds, memberships],
  );

  if (commonMemberships.length === 0) {
    return null;
  }

  return (
    <div className="tribes-common">
      <h4>{t('Circles in common')}</h4>
      <ul className="list-inline">
        {commonMemberships.map(membership => (
          <li key={membership.tribe._id}>
            <a
              className="tribe-link"
              href={`/circles/${membership.tribe.slug}`}
            >
              {membership.tribe.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

TribesInCommon.propTypes = {
  memberIds: PropTypes.array,
  memberships: PropTypes.array,
};
