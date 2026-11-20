import { createFileRoute } from '@tanstack/react-router';
import AdminSearchUsers from '@/modules/admin/client/components/AdminSearchUsers.component';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/search-users')(
  routeOptions(adminPolicy('Admin - Search users'), AdminSearchUsers),
);
