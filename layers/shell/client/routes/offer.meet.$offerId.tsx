import { createRoute } from '@tanstack/react-router';
import OfferMeetEditPage from '@/modules/offers/client/components/OfferMeetEditPage.component';
import { routeOptions, renderOfferPage } from '../route-options';

export const Route = createRoute(
  routeOptions('/offer/meet/:offerId', renderOfferPage(OfferMeetEditPage)),
);
