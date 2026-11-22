import { createFileRoute } from '@tanstack/react-router';
import AdminLocationCorrections from '@/modules/admin/client/components/AdminLocationCorrections.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/location-corrections')({
  staticData: {
    title: 'Welcome team - Location corrections',
    footerVariant: 'admin',
  },
  beforeLoad: requireRole('admin', 'welcome-team'),
  component: AdminLocationCorrections,
});
