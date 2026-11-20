import { createFileRoute } from '@tanstack/react-router';
import OfferMeetEditPage from '@/modules/offers/client/components/OfferMeetEditPage.component';
import { routeOptions, renderOfferPage } from '../route-options';

export const Route = createFileRoute('/offer/meet/add')(
  routeOptions('/offer/meet/add', renderOfferPage(OfferMeetEditPage)),
);
