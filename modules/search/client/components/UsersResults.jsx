// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import UsersList from '@/modules/users/client/components/UsersList';
import NoContent from '@/modules/core/client/components/NoContent';

export default function UsersResults({ users }) {
  const { t } = useTranslation('search');
  if (!users || users.length === 0) {
    return (
      <NoContent icon="users" message={t('No members found by this name.')} />
    );
  }

  return (
    <div className="row">
      <div className="col-xs-12">
        <h4 className="text-muted">
          {t('{{count}} members found', { count: users.length })}
        </h4>
        <UsersList users={users} />
      </div>
    </div>
  );
}

UsersResults.propTypes = {
  users: PropTypes.array,
};
