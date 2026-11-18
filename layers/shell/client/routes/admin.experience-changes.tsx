import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminExperienceChanges from '@/modules/admin/client/components/AdminExperienceChanges';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/experience-changes')(
  routeOptions('/admin/experience-changes', () => <AdminExperienceChanges />),
);
