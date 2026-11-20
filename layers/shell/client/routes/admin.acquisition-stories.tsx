import { createFileRoute } from '@tanstack/react-router';
import AdminAcquisitionStories from '@/modules/admin/client/components/AdminAcquisitionStories.component';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/acquisition-stories')(
  routeOptions(
    adminPolicy('Admin - Acquisition stories', [
      'admin',
      'welcome-team',
      'support-team',
    ]),
    AdminAcquisitionStories,
  ),
);
