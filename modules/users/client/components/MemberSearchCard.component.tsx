import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@trustroots/ui/Badge';
import './member-search-card.css';

import MemberIdentity from './MemberIdentity';
import type { UserProfile } from '../types';

type MemberCardUser = React.ComponentProps<typeof MemberIdentity>['user'] &
  Pick<UserProfile, 'username'> &
  Partial<Pick<UserProfile, 'locationLiving' | 'locationFrom' | 'tagline'>>;

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

export default function MemberSearchCard({
  user,
  query = '',
  activityLabel,
  compact = false,
}: {
  user: MemberCardUser;
  query?: string;
  activityLabel?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation('search') as { t: (key: string) => string };
  return (
    <a
      className="member-search-card"
      data-compact={compact || undefined}
      href={`/profile/${encodeURIComponent(user.username)}`}
    >
      <MemberIdentity
        className="member-search-card-identity"
        size={compact ? 36 : 64}
        user={user}
        format={value => highlightMatches(value, query)}
      />
      <div className="member-search-card-details">
        {user.locationLiving && (
          <p>
            {String(t('Lives in'))}:{' '}
            {highlightMatches(user.locationLiving, query)}
          </p>
        )}
        {user.locationFrom && (
          <p>
            {String(t('From'))}: {highlightMatches(user.locationFrom, query)}
          </p>
        )}
        {user.tagline && (
          <p className="member-search-card-tagline">
            {highlightMatches(user.tagline, query)}
          </p>
        )}
        {activityLabel && (
          <div className="member-search-card-activity">
            <Badge variant="outline" intent="neutral">
              {activityLabel}
            </Badge>
          </div>
        )}
      </div>
    </a>
  );
}
