import { createFileRoute, Outlet } from '@tanstack/react-router';
import React from 'react';
import OfferShell from '@/modules/offers/client/components/OfferShell.component';
import { useAuth } from '@trustroots/core/auth';

function OfferLayout() {
  const { user } = useAuth();
  return (
    <OfferShell user={user}>
      <Outlet />
    </OfferShell>
  );
}

export const Route = createFileRoute('/offer')({ component: OfferLayout });
