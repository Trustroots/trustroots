import { createFileRoute } from '@tanstack/react-router';
import OfferMeetListPage from '@/modules/offers/client/components/OfferMeetListPage.component';
import { routeOptions, renderOfferPage } from '../route-options';

export const Route = createFileRoute('/offer/meet/')(
  routeOptions('/offer/meet', renderOfferPage(OfferMeetListPage)),
);
