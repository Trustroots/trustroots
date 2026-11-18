import { createFileRoute } from '@tanstack/react-router';
import { routeOptions } from '../route-options';
import { AdminUserRoute } from './admin.user.$username';

export const Route = createFileRoute('/admin/user/')(
  routeOptions('/admin/user', AdminUserRoute),
);
