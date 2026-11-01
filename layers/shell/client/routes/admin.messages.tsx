import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminMessages from '@/modules/admin/client/components/AdminMessages.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/messages', () => <AdminMessages />),
);
