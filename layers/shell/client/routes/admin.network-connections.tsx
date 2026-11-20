import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminHeader from '@/modules/admin/client/components/AdminHeader.component';
import { NetworkConnectionSearchPage } from '@/modules/admin/client/components/NetworkConnections.component';
import { requireRole } from '../route-options';

function NetworkConnectionsRoute() {
  return (
    <>
      <AdminHeader />
      <NetworkConnectionSearchPage />
    </>
  );
}

export const Route = createFileRoute('/admin/network-connections')({
  staticData: {
    title: 'Admin - External connection search',
    footerVariant: 'admin',
  },
  beforeLoad: requireRole('admin', 'support-team'),
  component: NetworkConnectionsRoute,
});
