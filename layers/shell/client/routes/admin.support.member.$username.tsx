import { createFileRoute, useParams } from '@tanstack/react-router';
import React from 'react';
import { SupportMemberPage } from '@/modules/admin/client/components/Support.component';
import { routeOptions } from '../route-options';

function SupportMemberRoute() {
  const { username } = useParams({ from: '/admin/support/member/$username' });
  return <SupportMemberPage id={username} />;
}

export const Route = createFileRoute('/admin/support/member/$username')(
  routeOptions('/admin/support/member/:username', SupportMemberRoute),
);
