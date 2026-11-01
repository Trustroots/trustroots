import { createRoute } from '@tanstack/react-router';
import OfferHostPage from '@/modules/offers/client/components/OfferHostPage.component';
import { routeOptions, renderOfferPage } from '../route-options';

export const Route = createRoute(
  routeOptions('/offer/host', renderOfferPage(OfferHostPage)),
);
