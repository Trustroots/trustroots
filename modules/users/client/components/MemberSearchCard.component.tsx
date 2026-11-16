import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@trustroots/ui/Badge';

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
      className={[
        'member-search-card member-card-surface tw:group tw:flex tw:flex-col tw:gap-[var(--member-card-gap)] tw:text-inherit tw:no-underline',
        'tw:transition-[border-color,box-shadow,transform] tw:duration-150 tw:ease-[ease]',
        'tw:[&:hover,&:focus-visible]:text-inherit tw:[&:hover,&:focus-visible]:no-underline tw:[&:hover,&:focus-visible]:shadow-[0_5px_18px_rgb(26_68_47_/_10%)] tw:[&:hover,&:focus-visible]:[transform:translateY(-1px)]',
        'tw:focus-visible:outline-3 tw:focus-visible:outline-solid tw:focus-visible:outline-offset-2 tw:focus-visible:outline-[rgb(72_130_97_/_35%)]',
      ].join(' ')}
      data-compact={compact || undefined}
      href={`/profile/${encodeURIComponent(user.username)}`}
    >
      <MemberIdentity
        className="member-search-card-identity"
        size={compact ? 36 : 64}
        user={user}
        format={value => highlightMatches(value, query)}
      />
      <div className="member-search-card-details tw:flex tw:min-w-0 tw:flex-col tw:gap-1 tw:self-stretch tw:empty:hidden tw:group-data-[compact]:gap-0.5 tw:group-data-[compact]:leading-[1.3] tw:[&>p]:mt-0.5 tw:[&>p]:mb-0 tw:group-data-[compact]:[&>p]:m-0">
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
          <p className="tw:line-clamp-2">
            {highlightMatches(user.tagline, query)}
          </p>
        )}
        {activityLabel && (
          <div className="tw:mt-auto tw:pt-1.5 tw:group-data-[compact]:pt-0.5 tw:[&_[data-slot=badge]]:whitespace-normal">
            <Badge variant="outline" intent="neutral">
              {activityLabel}
            </Badge>
          </div>
        )}
      </div>
    </a>
  );
}
