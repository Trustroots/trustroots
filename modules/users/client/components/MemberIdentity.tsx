import React from 'react';
import { useTranslation } from 'react-i18next';

import MemberAvatar from './MemberAvatar';

type IdentityMember = React.ComponentProps<typeof MemberAvatar>['user'];

export default function MemberIdentity({
  user,
  size,
  className = '',
  format = value => value,
}: {
  user: IdentityMember;
  size: number;
  className?: string;
  format?: (value: string) => React.ReactNode;
}) {
  const { t } = useTranslation('users');
  const displayName = user.displayName?.trim();
  const username = user.username?.trim();
  const handle = username && `@${username}`;
  const name = displayName || handle || t('Unknown member');

  return (
    <span
      className={`member-identity tw:flex tw:min-w-0 tw:items-center tw:gap-2.5 tw:wrap-anywhere tw:[&_.avatar]:rounded-full tw:[&_.avatar]:object-cover ${className}`.trimEnd()}
    >
      <MemberAvatar size={size} user={user} />
      <span className="tw:flex tw:min-w-0 tw:flex-col tw:leading-[1.3]">
        <span className="tw:font-semibold">{format(name)}</span>
        {displayName && handle && (
          <span className="text-muted">{format(handle)}</span>
        )}
      </span>
    </span>
  );
}
