import { createFileRoute } from '@tanstack/react-router';
import AdminReferenceThreads from '@/modules/admin/client/components/AdminReferenceThreads.component';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/reference-threads')(
  routeOptions(adminPolicy('Admin - Reference threads'), AdminReferenceThreads),
);
