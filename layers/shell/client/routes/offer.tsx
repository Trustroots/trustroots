import { createFileRoute, Outlet } from '@tanstack/react-router';
import React from 'react';
import { OfferLayout } from '@trustroots/offers/route-views';

export const Route = createFileRoute('/offer')({
  component: function OfferRoute() {
    return (
      <OfferLayout>
        <Outlet />
      </OfferLayout>
    );
  },
});
