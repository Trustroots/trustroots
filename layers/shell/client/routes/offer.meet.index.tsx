import { createRoute } from '@tanstack/react-router';
import OfferMeetListPage from '@/modules/offers/client/components/OfferMeetListPage.component';
import { routeOptions, renderOfferPage } from '../route-options';

export const Route = createRoute(
  routeOptions('/offer/meet', renderOfferPage(OfferMeetListPage)),
);
