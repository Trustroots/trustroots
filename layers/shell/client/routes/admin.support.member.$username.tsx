import { createFileRoute, useParams } from '@tanstack/react-router';
import React from 'react';
import { SupportMemberPage } from '@/modules/admin/client/components/Support.component';
import { requireRole } from '../route-options';

function SupportMemberRoute() {
  const { username } = useParams({ from: '/admin/support/member/$username' });
  return <SupportMemberPage id={username} />;
}

export const Route = createFileRoute('/admin/support/member/$username')({
  staticData: { title: 'Support - Member', footerVariant: 'admin' },
  beforeLoad: requireRole('admin', 'support-team'),
  component: SupportMemberRoute,
});
