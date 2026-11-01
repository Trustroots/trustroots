import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminNewsletter from '@/modules/admin/client/components/AdminNewsletter.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/newsletter', () => <AdminNewsletter />),
);
