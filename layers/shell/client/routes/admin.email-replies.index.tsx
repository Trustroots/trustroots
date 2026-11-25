import { createFileRoute } from '@tanstack/react-router';
import { redirectTo } from '../route-options';

export const Route = createFileRoute('/admin/email-replies/')({
  staticData: { title: 'Admin - Email replies', footerVariant: 'admin' },
  beforeLoad: redirectTo('/admin/email/replies'),
});
