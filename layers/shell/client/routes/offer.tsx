import { createFileRoute, Outlet } from '@tanstack/react-router';
import React from 'react';
import { OfferLayout } from '@/modules/offers/client/route-views';

export const Route = createFileRoute('/offer')({
  component: function OfferRoute() {
    return (
      <OfferLayout>
        <Outlet />
      </OfferLayout>
    );
  },
});
