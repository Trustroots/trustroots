import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminGravatar from '@/modules/admin/client/components/AdminGravatar.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/gravatar', () => <AdminGravatar />),
);
