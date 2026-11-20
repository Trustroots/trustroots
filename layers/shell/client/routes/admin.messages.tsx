import { createFileRoute } from '@tanstack/react-router';
import AdminMessages from '@/modules/admin/client/components/AdminMessages.component';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/messages')(
  routeOptions(adminPolicy('Admin - Messages'), AdminMessages),
);
