import { useTranslation } from 'react-i18next';
import React from 'react';
import styled from 'styled-components';

import MemberSearchCard from '@/modules/users/client/components/MemberSearchCard.component';
import NoContent from '@/modules/core/client/components/NoContent';
import type { UserProfile } from '@/modules/users/client/types';

const Results = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;

  @media (min-width: 616px) {
    grid-template-columns: 1fr 1fr;
  }
`;

export default function UsersResults({
  users,
  query = '',
}: {
  users: UserProfile[] | null;
  query?: string;
}) {
  const { t } = useTranslation('search');
  const mapHref = `/search?location=${encodeURIComponent(query.trim())}`;

  if (!users || users.length === 0) {
    return (
      <>
        <NoContent icon="users" message={String(t('No members found.'))} />
        {query.trim() && (
          <p className="text-center">
            <a className="btn btn-default" href={mapHref}>
              <i className="icon-map" aria-hidden="true" />{' '}
              {String(t('Search this place on the map'))}
            </a>
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <h4 className="text-muted">
        {String(t('{{count}} members found', { count: users.length }))}
      </h4>
      {query.trim() && (
        <p>
          <a className="btn btn-default" href={mapHref}>
            <i className="icon-map" aria-hidden="true" />{' '}
            {String(t('Search this place on the map'))}
          </a>
        </p>
      )}
      <Results>
        {users.map(user => (
          <MemberSearchCard key={user._id} user={user} query={query} />
        ))}
      </Results>
    </>
  );
}
