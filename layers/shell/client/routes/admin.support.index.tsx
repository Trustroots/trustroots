import { createFileRoute } from '@tanstack/react-router';
import SupportInbox from '@/modules/admin/client/components/Support.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/support/')({
  staticData: { title: 'Support', footerVariant: 'admin' },
  beforeLoad: requireRole('admin', 'support-team'),
  component: SupportInbox,
});
