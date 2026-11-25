import { createFileRoute } from '@tanstack/react-router';
import { redirectTo } from '../route-options';

export const Route = createFileRoute('/admin/sparkpost')({
  staticData: { title: 'Admin - SparkPost', footerVariant: 'admin' },
  beforeLoad: redirectTo('/admin/email/sparkpost'),
});
