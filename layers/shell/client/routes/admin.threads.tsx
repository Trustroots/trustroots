import { createFileRoute } from '@tanstack/react-router';
import AdminThreads from '@/modules/admin/client/components/AdminThreads.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/threads')(
  routeOptions('/admin/threads', AdminThreads),
);
