import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminHeader from '@/modules/admin/client/components/AdminHeader.component';
import { NetworkConnectionSearchPage } from '@/modules/admin/client/components/NetworkConnections.component';
import { adminPolicy, routeOptions } from '../route-options';

function NetworkConnectionsRoute() {
  return (
    <>
      <AdminHeader />
      <NetworkConnectionSearchPage />
    </>
  );
}

export const Route = createFileRoute('/admin/network-connections')(
  routeOptions(
    adminPolicy('Admin - External connection search', [
      'admin',
      'support-team',
    ]),
    NetworkConnectionsRoute,
  ),
);
