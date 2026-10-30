import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminReferenceThreads from '@/modules/admin/client/components/AdminReferenceThreads.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/reference-threads', () => <AdminReferenceThreads />),
);
