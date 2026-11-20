import { createFileRoute } from '@tanstack/react-router';
import AdminExperienceChanges from '@/modules/admin/client/components/AdminExperienceChanges';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/experience-changes')({
  staticData: { title: 'Admin - Experience changes', footerVariant: 'admin' },
  beforeLoad: requireRole('admin', 'support-team'),
  component: AdminExperienceChanges,
});
