import { createFileRoute, redirect, useParams } from '@tanstack/react-router';
import React from 'react';
import TribeDetailPage from '@/modules/tribes/client/components/TribeDetailPage.component';
import { circleQuery } from '@/modules/tribes/client/api/circle-queries';
import useMembershipUpdated from '@/modules/tribes/client/hooks/useMembershipUpdated';
import { useAuth } from '@/modules/core/client/react-app/auth';
import { guard, routeOptions } from '../route-options';

function TribeDetailPageRoute() {
  const { user } = useAuth();
  const { circle } = useParams({ from: '/circles/$circle' });
  const onMembershipUpdated = useMembershipUpdated();
  return (
    <TribeDetailPage
      circle={circle}
      onMembershipUpdated={onMembershipUpdated}
      user={user as React.ComponentProps<typeof TribeDetailPage>['user']}
    />
  );
}

const policy = { title: 'Circle', footerVariant: 'circle' };

export const Route = createFileRoute('/circles/$circle')({
  ...routeOptions(policy, TribeDetailPageRoute),
  beforeLoad: options => {
    const { circle } = options.params as { circle: string };
    if (!/^[a-z0-9-]+$/.test(circle)) {
      throw redirect({ replace: true, to: '/not-found' });
    }
    guard({ ...policy, requiresAuth: circle === 'naturists' }, options);
  },
  // Fetch early without blocking navigation; the page shows its own loading.
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(
      circleQuery((params as { circle: string }).circle, context.user?._id),
    );
  },
});
