import React from 'react';
import { useTranslation } from 'react-i18next';

import MemberAvatar from './MemberAvatar';

type IdentityMember = React.ComponentProps<typeof MemberAvatar>['user'];

export default function MemberIdentity({
  user,
  size,
  className = '',
  format = value => value,
  profileLink = false,
  heading = false,
  renderAvatar = avatar => avatar,
}: {
  user: IdentityMember;
  size: number;
  className?: string;
  format?: (value: string) => React.ReactNode;
  profileLink?: boolean;
  heading?: boolean;
  renderAvatar?: (avatar: React.ReactNode) => React.ReactNode;
}) {
  const { t } = useTranslation('users');
  const displayName = user.displayName?.trim();
  const username = user.username?.trim();
  const handle = username && `@${username}`;
  const name = displayName || handle || t('Unknown member');

  const content = (
    <>
      {renderAvatar(<MemberAvatar size={size} user={user} />)}
      <span className="tw:flex tw:min-w-0 tw:flex-col tw:leading-[1.3]">
        <span
          className={
            heading
              ? 'profile-name tw:m-0! tw:p-0! tw:font-semibold'
              : 'tw:font-semibold'
          }
          role={heading ? 'heading' : undefined}
          aria-level={heading ? 2 : undefined}
        >
          {format(name)}
        </span>
        {displayName && handle && (
          <span
            className={
              heading
                ? 'text-muted profile-username tw:m-0! tw:p-0!'
                : 'text-muted'
            }
          >
            {format(handle)}
          </span>
        )}
      </span>
    </>
  );
  const identityClassName =
    `member-identity tw:flex tw:min-w-0 tw:items-center tw:gap-2.5 tw:wrap-anywhere tw:[&_.avatar]:rounded-full tw:[&_.avatar]:object-cover ${className}`.trimEnd();

  return profileLink && username ? (
    <a
      className={identityClassName}
      href={`/profile/${encodeURIComponent(username)}`}
    >
      {content}
    </a>
  ) : (
    <span className={identityClassName}>{content}</span>
  );
}
