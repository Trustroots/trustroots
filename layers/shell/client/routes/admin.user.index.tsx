import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminUser from '@/modules/admin/client/components/AdminUser.component';
import { useAuth } from '@/modules/core/client/react-app/auth';
import Offers from '@/modules/offers/client/components/Offers.component';
import { requireRole } from '../route-options';

function AdminUserSearchRoute() {
  const { user } = useAuth();
  return <AdminUser ProfileOffers={Offers} viewer={user} />;
}

export const Route = createFileRoute('/admin/user/')({
  staticData: { title: 'Admin - User', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminUserSearchRoute,
});
