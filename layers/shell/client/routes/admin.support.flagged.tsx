import { createFileRoute } from '@tanstack/react-router';
import FlaggedMembers from '@/modules/admin/client/components/FlaggedMembers.component';
import { requireRole } from '../route-options';
export const Route = createFileRoute('/admin/support/flagged')({
  staticData: { title: 'Support - Flagged members', footerVariant: 'admin' },
  beforeLoad: requireRole('admin', 'support-team'),
  component: FlaggedMembers,
});
