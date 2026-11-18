import { createFileRoute } from '@tanstack/react-router';
import AdminSearchUsers from '@/modules/admin/client/components/AdminSearchUsers.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/search-users')(
  routeOptions('/admin/search-users', AdminSearchUsers),
);
