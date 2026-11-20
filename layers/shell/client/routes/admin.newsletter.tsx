import { createFileRoute } from '@tanstack/react-router';
import AdminNewsletter from '@/modules/admin/client/components/AdminNewsletter.component';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/newsletter')(
  routeOptions(adminPolicy('Admin - Newsletter'), AdminNewsletter),
);
