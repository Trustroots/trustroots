import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminStaffBlockers from '@/modules/admin/client/components/AdminStaffBlockers.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/staff-blockers')(
  routeOptions('/admin/staff-blockers', () => <AdminStaffBlockers />),
);
