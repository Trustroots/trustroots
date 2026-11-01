import { createRoute } from '@tanstack/react-router';
import React from 'react';
import SupportInbox from '@/modules/admin/client/components/Support.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/support', () => <SupportInbox />),
);
