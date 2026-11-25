import { createFileRoute, redirect, useParams } from '@tanstack/react-router';
import { circleQuery } from '@/modules/tribes/client/api/circle-queries';
import { requireAuth } from '../route-options';
import React from 'react';
import { TribeDetailPageRoute } from '@/modules/tribes/client/route-views';

export const Route = createFileRoute('/circles/$circle')({
  staticData: { title: 'Circle', footerVariant: 'circle' },
  beforeLoad: options => {
    const { circle } = options.params as { circle: string };
    if (!/^[a-z0-9-]+$/.test(circle)) {
      throw redirect({ replace: true, to: '/not-found' });
    }
    if (circle === 'naturists') requireAuth(options);
  },
  component: function CircleRoute() {
    const { circle } = useParams({ from: '/circles/$circle' });
    return <TribeDetailPageRoute circle={circle} />;
  },
  // Fetch early without blocking navigation; the page shows its own loading.
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(
      circleQuery((params as { circle: string }).circle, context.user?._id),
    );
  },
});
