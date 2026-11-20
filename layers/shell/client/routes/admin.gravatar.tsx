import { createFileRoute } from '@tanstack/react-router';
import AdminGravatar from '@/modules/admin/client/components/AdminGravatar.component';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/gravatar')(
  routeOptions(adminPolicy('Admin - Gravatar usage'), AdminGravatar),
);
