import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminThreads from '@/modules/admin/client/components/AdminThreads.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/threads', () => <AdminThreads />),
);
