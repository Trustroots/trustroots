import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import { update } from '@/modules/users/client/api/users.api';
import ProfileEditAccount from '@/modules/users/client/components/ProfileEditAccount.component';
import type { UserProfile } from '@/modules/users/client/types';
import { requireAuth, withUser } from '../route-options';

function AccountSettingsRoute({ user }: { user: UserProfile }) {
  return (
    <ProfileEditAccount user={user} saveLocale={locale => update({ locale })} />
  );
}

export const Route = createFileRoute('/profile/edit/account')({
  staticData: { title: 'Account' },
  beforeLoad: requireAuth,
  component: withUser(AccountSettingsRoute),
});
