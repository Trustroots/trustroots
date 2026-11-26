import React from 'react';
import AdminUser from './components/AdminUser.component';
import { SupportMemberPage } from './components/Support.component';
import { useAuth } from '@trustroots/core/auth';
import AdminHeader from './components/AdminHeader.component';
import { NetworkConnectionSearchPage } from './components/NetworkConnections.component';
import type { ProfilePageProps } from '@/modules/users/client/components/ProfilePage.component';

type MemberProfileComponent = React.ComponentType<ProfilePageProps>;

export function AdminUserRoute({
  username,
  MemberProfile,
}: {
  username: string;
  MemberProfile: MemberProfileComponent;
}) {
  const { hasRole, user } = useAuth();
  return hasRole('admin') ? (
    <AdminUser
      MemberProfile={MemberProfile}
      username={username}
      viewer={user}
    />
  ) : (
    <SupportMemberPage id={username} />
  );
}

export function AdminUserSearchRoute({
  MemberProfile,
}: {
  MemberProfile: MemberProfileComponent;
}) {
  const { user } = useAuth();
  return <AdminUser MemberProfile={MemberProfile} viewer={user} />;
}

export function NetworkConnectionsRoute() {
  return (
    <>
      <AdminHeader />
      <NetworkConnectionSearchPage />
    </>
  );
}
