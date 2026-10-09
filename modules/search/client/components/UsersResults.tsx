import { useTranslation } from 'react-i18next';
import React from 'react';
import styled from 'styled-components';

import MemberAvatar from '@/modules/users/client/components/MemberAvatar';
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

const MemberCard = styled.a.attrs({ className: 'member-search-card' })`
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
  padding: 16px;
  border: 1px solid #e5e8e6;
  border-radius: 12px;
  background: #fff;
  color: inherit;
  overflow-wrap: anywhere;
  text-decoration: none;
  transition: border-color 150ms ease, box-shadow 150ms ease,
    transform 150ms ease;

  &:hover,
  &:focus-visible {
    border-color: #94b8a4;
    box-shadow: 0 5px 18px rgb(26 68 47 / 10%);
    color: inherit;
    text-decoration: none;
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 3px solid rgb(72 130 97 / 35%);
    outline-offset: 2px;
  }

  .avatar,
  .member-avatar-fallback {
    flex: 0 0 auto;
    border-radius: 50%;
    object-fit: cover;
  }
`;

const Details = styled.div`
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;

  p {
    margin: 2px 0 0;
  }
`;

const DisplayName = styled.span`
  font-size: 1.05rem;
  font-weight: 400;
  line-height: 1.3;
`;

function highlightMatches(value: string, query: string) {
  const terms = query.match(/[\p{L}\p{N}]+/gu) || [];
  const lowerValue = value.toLocaleLowerCase();
  const ranges = terms.flatMap(term => {
    const matches: Array<{ start: number; end: number }> = [];
    const lowerTerm = term.toLocaleLowerCase();
    let start = lowerValue.indexOf(lowerTerm);
    while (start !== -1) {
      matches.push({ start, end: start + term.length });
      start = lowerValue.indexOf(lowerTerm, start + term.length);
    }
    return matches;
  });

  if (!ranges.length) return value;
  ranges.sort((a, b) => a.start - b.start);
  const merged = ranges.reduce<Array<{ start: number; end: number }>>(
    (result, range) => {
      const previous = result[result.length - 1];
      if (previous && range.start <= previous.end) {
        previous.end = Math.max(previous.end, range.end);
      } else {
        result.push({ ...range });
      }
      return result;
    },
    [],
  );

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach((range, index) => {
    if (cursor < range.start) parts.push(value.slice(cursor, range.start));
    parts.push(
      <strong key={`${range.start}-${index}`}>
        {value.slice(range.start, range.end)}
      </strong>,
    );
    cursor = range.end;
  });
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts;
}

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
          <MemberCard
            href={`/profile/${encodeURIComponent(user.username)}`}
            key={user._id}
          >
            <MemberAvatar size={64} user={user} />
            <Details>
              <DisplayName>
                {highlightMatches(user.displayName, query)}
              </DisplayName>
              <span className="text-muted">
                @{highlightMatches(user.username, query)}
              </span>
              {user.locationLiving && (
                <p>
                  {String(t('Lives in'))}:{' '}
                  {highlightMatches(user.locationLiving, query)}
                </p>
              )}
              {user.locationFrom && (
                <p>
                  {String(t('From'))}:{' '}
                  {highlightMatches(user.locationFrom, query)}
                </p>
              )}
              {user.tagline && <p>{highlightMatches(user.tagline, query)}</p>}
            </Details>
          </MemberCard>
        ))}
      </Results>
    </>
  );
}
