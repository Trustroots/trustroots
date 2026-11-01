import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminAcquisitionStories from '@/modules/admin/client/components/AdminAcquisitionStories.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/acquisition-stories', () => <AdminAcquisitionStories />),
);
