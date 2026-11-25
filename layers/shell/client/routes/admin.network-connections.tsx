import { createFileRoute } from '@tanstack/react-router';
import { requireRole } from '../route-options';
import { NetworkConnectionsRoute } from '@/modules/admin/client/route-views';

export const Route = createFileRoute('/admin/network-connections')({
  staticData: {
    title: 'Admin - External connection search',
    footerVariant: 'admin',
  },
  beforeLoad: requireRole('admin', 'support-team'),
  component: NetworkConnectionsRoute,
});
