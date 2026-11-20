import { createFileRoute } from '@tanstack/react-router';
import Admin from '@/modules/admin/client/components/Admin.component';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/')(
  routeOptions(adminPolicy('Admin', ['admin', 'support-team']), Admin),
);
