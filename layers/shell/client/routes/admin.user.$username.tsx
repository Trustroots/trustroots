import { createFileRoute, useParams } from '@tanstack/react-router';
import React from 'react';
import AdminUser from '@/modules/admin/client/components/AdminUser.component';
import { SupportMemberPage } from '@/modules/admin/client/components/Support.component';
import { useAuth } from '@/modules/core/client/react-app/auth';
import Offers from '@/modules/offers/client/components/Offers.component';
import { requireRole } from '../route-options';

function AdminUserRoute() {
  const { hasRole, user } = useAuth();
  const { username } = useParams({ from: '/admin/user/$username' });
  return hasRole('admin') ? (
    <AdminUser ProfileOffers={Offers} username={username} viewer={user} />
  ) : (
    <SupportMemberPage id={username} />
  );
}

export const Route = createFileRoute('/admin/user/$username')({
  staticData: { title: 'Admin - User', footerVariant: 'admin' },
  beforeLoad: requireRole('admin', 'support-team'),
  component: AdminUserRoute,
});
