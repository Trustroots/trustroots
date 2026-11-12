import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminHeader from '@/modules/admin/client/components/AdminHeader.component';
import { NetworkConnectionSearchPage } from '@/modules/admin/client/components/NetworkConnections.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/network-connections', () => (
    <>
      <AdminHeader />
      <NetworkConnectionSearchPage />
    </>
  )),
);
