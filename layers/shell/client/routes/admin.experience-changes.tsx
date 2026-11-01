import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminExperienceChanges from '@/modules/admin/client/components/AdminExperienceChanges';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/experience-changes', () => <AdminExperienceChanges />),
);
