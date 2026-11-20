import { createFileRoute } from '@tanstack/react-router';
import OfferMeetEditPage from '@/modules/offers/client/components/OfferMeetEditPage.component';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/offer/meet/$offerId')(
  routeOptions(
    { title: 'Edit meeting offer', requiresAuth: true, footerHidden: true },
    withUser(OfferMeetEditPage),
  ),
);
