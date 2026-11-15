import React from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import MemberAvatar from './MemberAvatar';

type IdentityMember = Partial<
  React.ComponentProps<typeof MemberAvatar>['user']
>;

const Identity = styled.span`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  overflow-wrap: anywhere;

  .avatar {
    border-radius: 50%;
    object-fit: cover;
  }
`;

const Names = styled.span`
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.3;
`;

const DisplayName = styled.span`
  font-weight: 600;
`;

export default function MemberIdentity({
  user,
  size,
  className,
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
    <Identity className={className}>
      <MemberAvatar
        size={size}
        user={{
          ...user,
          _id: user._id ?? '',
          username: username ?? '',
          displayName: displayName ?? '',
        }}
      />
      <Names>
        <DisplayName>{format(name)}</DisplayName>
        {displayName && handle && (
          <span className="text-muted">{format(handle)}</span>
        )}
      </Names>
    </Identity>
  );
}
