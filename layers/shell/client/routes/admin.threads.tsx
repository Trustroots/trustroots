import { createRoute } from '@tanstack/react-router';
import { adminRoutes } from '@/modules/admin/client/routes';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/threads', adminRoutes['/admin/threads']),
);
