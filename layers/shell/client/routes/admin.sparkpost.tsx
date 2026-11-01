import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminSparkpost from '@/modules/admin/client/components/AdminSparkpost.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/sparkpost', () => <AdminSparkpost />),
);
