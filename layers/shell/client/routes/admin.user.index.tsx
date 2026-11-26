import { createFileRoute } from '@tanstack/react-router';
import { requireRole } from '../route-options';
import Offers from '@/modules/offers/client/components/Offers.component';
import { AdminUserSearchRoute } from '@/modules/admin/client/route-views';

export const Route = createFileRoute('/admin/user/')({
  staticData: { title: 'Admin - User', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: function AdminUserIndexRoute() {
    return <AdminUserSearchRoute ProfileOffers={Offers} />;
  },
});
