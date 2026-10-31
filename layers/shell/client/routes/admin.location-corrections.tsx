import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminLocationCorrections from '@/modules/admin/client/components/AdminLocationCorrections.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/location-corrections', () => (
    <AdminLocationCorrections />
  )),
);
