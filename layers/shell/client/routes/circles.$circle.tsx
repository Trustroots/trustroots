import { createFileRoute, redirect, useParams } from '@tanstack/react-router';
import React from 'react';
import TribeDetailPage from '@/modules/tribes/client/components/TribeDetailPage.component';
import { circleQuery } from '@/modules/tribes/client/api/circle-queries';
import useMembershipUpdated from '@/modules/tribes/client/hooks/useMembershipUpdated';
import { useAuth } from '@trustroots/core/auth';
import { requireAuth } from '../route-options';

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

export const Route = createFileRoute('/circles/$circle')({
  staticData: { title: 'Circle', footerVariant: 'circle' },
  beforeLoad: options => {
    const { circle } = options.params as { circle: string };
    if (!/^[a-z0-9-]+$/.test(circle)) {
      throw redirect({ replace: true, to: '/not-found' });
    }
    if (circle === 'naturists') requireAuth(options);
  },
  component: TribeDetailPageRoute,
  // Fetch early without blocking navigation; the page shows its own loading.
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(
      circleQuery((params as { circle: string }).circle, context.user?._id),
    );
  },
});
