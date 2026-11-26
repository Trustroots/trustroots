import React from 'react';
import AdminUser from './components/AdminUser.component';
import { SupportMemberPage } from './components/Support.component';
import { useAuth } from '@/modules/core/client/react-app/auth';
import AdminHeader from './components/AdminHeader.component';
import { NetworkConnectionSearchPage } from './components/NetworkConnections.component';

export function AdminUserRoute({ username }: { username: string }) {
  const { hasRole, user } = useAuth();
  return hasRole('admin') ? (
    <AdminUser username={username} viewer={user} />
  ) : (
    <SupportMemberPage id={username} />
  );
}

export function AdminUserSearchRoute() {
  const { user } = useAuth();
  return <AdminUser viewer={user} />;
}

export function NetworkConnectionsRoute() {
  return (
    <>
      <AdminHeader />
      <NetworkConnectionSearchPage />
    </>
  );
}
