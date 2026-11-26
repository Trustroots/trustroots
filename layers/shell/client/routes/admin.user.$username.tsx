import { createFileRoute, useParams } from '@tanstack/react-router';
import { requireRole } from '../route-options';
import React from 'react';
import Offers from '@/modules/offers/client/components/Offers.component';
import { AdminUserRoute } from '@/modules/admin/client/route-views';

export const Route = createFileRoute('/admin/user/$username')({
  staticData: { title: 'Admin - User', footerVariant: 'admin' },
  beforeLoad: requireRole('admin', 'support-team'),
  component: function UsernameRoute() {
    const { username } = useParams({ from: '/admin/user/$username' });
    return <AdminUserRoute ProfileOffers={Offers} username={username} />;
  },
});
