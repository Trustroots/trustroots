// External dependencies
import { useTranslation } from 'react-i18next';
import React from 'react';

// Internal dependencies
import UsersList from '@/modules/users/client/components/UsersList';
import NoContent from '@/modules/core/client/components/NoContent';

export default function UsersResults({
  users,
}: {
  users: Array<Record<string, unknown>>;
}) {
  const { t } = useTranslation('search');
  if (!users || users.length === 0) {
    return (
      <NoContent
        icon="users"
        message={String(t('No members found by this name.'))}
      />
    );
  }

  return (
    <div className="row">
      <div className="col-xs-12">
        <h4 className="text-muted">
          {String(t('{{count}} members found', { count: users.length }))}
        </h4>
        <UsersList users={users} />
      </div>
    </div>
  );
}
