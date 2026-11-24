import { createFileRoute, useParams } from '@tanstack/react-router';
import React from 'react';
import { SupportMessageReviewPage } from '@/modules/admin/client/components/Support.component';
import { requireRole } from '../route-options';

function SupportMessageReviewRoute() {
  const { reviewId } = useParams({
    from: '/admin/support/message-reviews/$reviewId',
  });
  return <SupportMessageReviewPage key={reviewId} id={reviewId} />;
}

export const Route = createFileRoute(
  '/admin/support/message-reviews/$reviewId',
)({
  staticData: {
    title: 'Support - Review outgoing messages',
    footerVariant: 'admin',
  },
  beforeLoad: requireRole('admin', 'support-team'),
  component: SupportMessageReviewRoute,
});
