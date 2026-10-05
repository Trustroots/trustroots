import { useTranslation } from 'react-i18next';
import React from 'react';
import styled from 'styled-components';
import Avatar from '@/modules/users/client/components/Avatar.component';
import NoContent from '@/modules/core/client/components/NoContent';
import type { UserProfile } from '@/modules/users/client/types';

const Results = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
  @media (min-width: 768px) {
    grid-template-columns: 1fr 1fr;
  }
  .member-search-card {
    display: flex;
    gap: 14px;
    padding: 16px;
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .avatar {
    flex-shrink: 0;
  }
  h4 {
    margin: 0 0 4px;
  }
  p {
    margin: 6px 0 0;
  }
`;

export default function UsersResults({
  users,
  query = '',
}: {
  users: UserProfile[];
  query?: string;
}) {
  const { t } = useTranslation('search');
  if (!users || users.length === 0) {
    return <NoContent icon="users" message={String(t('No members found.'))} />;
  }
  const words = query.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  return (
    <>
      <h4 className="text-muted">
        {String(t('{{count}} members found', { count: users.length }))}
      </h4>
      <Results>
        {users.map(user => {
          const fields = [
            [t('Name'), user.displayName],
            [t('Username'), user.username],
            [t('Lives in'), user.locationLiving],
            [t('From'), user.locationFrom],
            [t('Tagline'), user.tagline],
          ];
          const matched = fields
            .filter(
              ([, value]) =>
                typeof value === 'string' &&
                words.some(word => value.toLocaleLowerCase().includes(word)),
            )
            .map(([label]) => label);
          return (
            <article
              className="panel panel-default member-search-card"
              key={user._id}
            >
              <Avatar link size={64} user={user} />
              <div>
                <h4>
                  <a href={`/profile/${encodeURIComponent(user.username)}`}>
                    {user.displayName}
                  </a>
                </h4>
                <span className="text-muted">@{user.username}</span>
                {user.locationLiving && (
                  <p>
                    {String(t('Lives in'))}: {user.locationLiving}
                  </p>
                )}
                {user.locationFrom && (
                  <p>
                    {String(t('From'))}: {user.locationFrom}
                  </p>
                )}
                {user.tagline && <p>{user.tagline}</p>}
                {matched.length > 0 && (
                  <p className="text-muted">
                    {String(t('Matches'))}: {matched.join(', ')}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </Results>
    </>
  );
}
