// External dependencies
import React, { useEffect, useState } from 'react';
import keyBy from 'lodash/keyBy';
import { useTranslation } from 'react-i18next';

// Internal dependencies
import { userType } from '@/modules/users/client/users.prop-types';
import Avatar from '@/modules/users/client/components/Avatar.component';
import LanguageList from './LanguageList';

function TribesInCommon({ user, otherUser }) {
  const { t } = useTranslation('users');

  const [tribesInCommon, setTribesInCommon] = useState([]);

  useEffect(() => {
    // user will have a filled out tribe details, otherUser won't...
    const byId = keyBy(
      user.member.map(membership => membership.tribe),
      tribe => tribe._id,
    );
    const tribesInCommon = otherUser.memberIds
      .filter(id => byId[id])
      .map(id => byId[id]);
    setTribesInCommon(tribesInCommon);
  }, [user, otherUser]);

  if (tribesInCommon.length === 0) return null;

  return (
    <div className="monkeybox-section">
      <div className="tribes-common">
        <h4>{t('Circles in common')}</h4>
        <ul className="list-inline">
          {tribesInCommon.map(tribe => (
            <li key={tribe._id}>
              <a className="tribe-link" href={`/circles/${tribe.slug}`}>
                {tribe.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

TribesInCommon.propTypes = {
  user: userType.isRequired,
  otherUser: userType.isRequired,
};

export default function Monkeybox({ user, otherUser }) {
  const { t } = useTranslation('users');
  return (
    <div className="monkeybox panel panel-default">
      <div className="panel-body">
        <Avatar user={user} size={64} />
        <h3>
          <a href={`/profile/${user.username}`}>{user.displayName}</a>
        </h3>
        <TribesInCommon user={user} otherUser={otherUser} />
        {user.languages.length > 0 && (
          <div className="monkeybox-section">
            <h4>{t('Languages')}</h4>
            <LanguageList
              className="list-unstyled"
              languages={user.languages}
            />
          </div>
        )}
      </div>
    </div>
  );
}

Monkeybox.propTypes = {
  user: userType.isRequired,
  otherUser: userType.isRequired,
};
