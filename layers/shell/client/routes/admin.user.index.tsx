import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import { requireRole } from '../route-options';
import MemberProfile from '../member-profile';
import { AdminUserSearchRoute } from '@/modules/admin/client/route-views';

export const Route = createFileRoute('/admin/user/')({
  staticData: { title: 'Admin - User', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: function AdminUserIndexRoute() {
    return <AdminUserSearchRoute MemberProfile={MemberProfile} />;
  },
});
