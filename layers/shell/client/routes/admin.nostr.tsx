import { createFileRoute } from '@tanstack/react-router';
import AdminNostr from '@/modules/admin/client/components/AdminNostr.component';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/nostr')(
  routeOptions(adminPolicy('Admin - Featured Nostr notes'), AdminNostr),
);
