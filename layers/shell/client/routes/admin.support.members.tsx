import { createFileRoute } from '@tanstack/react-router';
import { SupportMemberSearchPage } from '@/modules/admin/client/components/Support.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/support/members')({
  staticData: { title: 'Support - Member search', footerVariant: 'admin' },
  beforeLoad: requireRole('admin', 'support-team'),
  component: SupportMemberSearchPage,
});
