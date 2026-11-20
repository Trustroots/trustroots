import { createFileRoute } from '@tanstack/react-router';
import AdminExperienceChanges from '@/modules/admin/client/components/AdminExperienceChanges';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/experience-changes')(
  routeOptions(
    adminPolicy('Admin - Experience changes', ['admin', 'support-team']),
    AdminExperienceChanges,
  ),
);
