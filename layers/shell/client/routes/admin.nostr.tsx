import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminNostr from '@/modules/admin/client/components/AdminNostr.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/nostr', () => <AdminNostr />),
);
