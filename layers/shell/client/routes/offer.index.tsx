import { createRoute } from '@tanstack/react-router';
import React from 'react';
import OfferRedirectPage from '@/modules/offers/client/components/OfferRedirectPage.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/offer', () => <OfferRedirectPage />),
);
