import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminMongo from '@/modules/admin/client/components/AdminMongo.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/mongo', () => <AdminMongo />),
);
