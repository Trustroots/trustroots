import React from 'react';
import AdminUser from './components/AdminUser.component';
import { SupportMemberPage } from './components/Support.component';
import { useAuth } from '@trustroots/core/auth';
import AdminHeader from './components/AdminHeader.component';
import { NetworkConnectionSearchPage } from './components/NetworkConnections.component';
import type { ProfileOffersComponent } from '@/modules/users/client/components/ProfilePage.component';

export function AdminUserRoute({
  username,
  ProfileOffers,
}: {
  username: string;
  ProfileOffers: ProfileOffersComponent;
}) {
  const { hasRole, user } = useAuth();
  return hasRole('admin') ? (
    <AdminUser
      ProfileOffers={ProfileOffers}
      username={username}
      viewer={user}
    />
  ) : (
    <SupportMemberPage id={username} />
  );
}

export function AdminUserSearchRoute({
  ProfileOffers,
}: {
  ProfileOffers: ProfileOffersComponent;
}) {
  const { user } = useAuth();
  return <AdminUser ProfileOffers={ProfileOffers} viewer={user} />;
}

export function NetworkConnectionsRoute() {
  return (
    <>
      <AdminHeader />
      <NetworkConnectionSearchPage />
    </>
  );
}
