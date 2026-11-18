import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminHeader from '@/modules/admin/client/components/AdminHeader.component';
import { NetworkConnectionSearchPage } from '@/modules/admin/client/components/NetworkConnections.component';
import { routeOptions } from '../route-options';

function NetworkConnectionsRoute() {
  return (
    <>
      <AdminHeader />
      <NetworkConnectionSearchPage />
    </>
  );
}

export const Route = createFileRoute('/admin/network-connections')(
  routeOptions('/admin/network-connections', NetworkConnectionsRoute),
);
