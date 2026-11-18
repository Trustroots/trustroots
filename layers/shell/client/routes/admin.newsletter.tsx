import { createFileRoute } from '@tanstack/react-router';
import AdminNewsletter from '@/modules/admin/client/components/AdminNewsletter.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/newsletter')(
  routeOptions('/admin/newsletter', AdminNewsletter),
);
