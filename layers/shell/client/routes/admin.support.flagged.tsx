import { createRoute } from '@tanstack/react-router';
import React from 'react';
import FlaggedMembers from '@/modules/admin/client/components/FlaggedMembers.component';
import { routeOptions } from '../route-options';
export const Route = createRoute(
  routeOptions('/admin/support/flagged', () => <FlaggedMembers />),
);
