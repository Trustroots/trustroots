import React from 'react';
import OfferShell from './components/OfferShell.component';
import { useAuth } from '@/modules/core/client/react-app/auth';

export function OfferLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return <OfferShell user={user}>{children}</OfferShell>;
}
