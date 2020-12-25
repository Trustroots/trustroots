// External dependencies
import { useTranslation } from 'react-i18next';
import React from 'react';

// Internal dependencies
import { userType } from '@/modules/users/client/users.prop-types';
import Avatar from '@/modules/users/client/components/Avatar.component';
import CirclesInCommon from '@/modules/tribes/client/components/CirclesInCommon';
import LanguageList from './LanguageList';

export default function Monkeybox({ user, otherUser }) {
  const { t } = useTranslation('users');

  const circlesInCommon = <CirclesInCommon user={user} otherUser={otherUser} />;

  return (
    <div className="monkeybox panel panel-default">
      <div className="panel-body">
        <Avatar user={user} size={64} />
        <h3>
          <a href={`/profile/${user.username}`}>{user.displayName}</a>
        </h3>

        {circlesInCommon && (
          <div className="monkeybox-section">
            <div className="tribes-common">
              <h4>{t('Circles in common')}</h4>
              {circlesInCommon}
            </div>
          </div>
        )}

        {user?.languages?.length > 0 && (
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
