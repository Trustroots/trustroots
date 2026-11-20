import { createFileRoute } from '@tanstack/react-router';
import AdminAcquisitionStories from '@/modules/admin/client/components/AdminAcquisitionStories.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/acquisition-stories')({
  staticData: { title: 'Admin - Acquisition stories', footerVariant: 'admin' },
  beforeLoad: requireRole('admin', 'welcome-team', 'support-team'),
  component: AdminAcquisitionStories,
});
