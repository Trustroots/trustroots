import { createFileRoute } from '@tanstack/react-router';
import AdminUsernameChanges from '@/modules/admin/client/components/AdminUsernameChanges.component';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/username-changes')(
  routeOptions(adminPolicy('Admin - Username changes'), AdminUsernameChanges),
);
