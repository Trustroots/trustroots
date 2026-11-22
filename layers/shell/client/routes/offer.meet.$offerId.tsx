import { createFileRoute } from '@tanstack/react-router';
import OfferMeetEditPage from '@/modules/offers/client/components/OfferMeetEditPage.component';
import { requireAuth, withUser } from '../route-options';

export const Route = createFileRoute('/offer/meet/$offerId')({
  staticData: { title: 'Edit meeting offer', footerHidden: true },
  beforeLoad: requireAuth,
  component: withUser(OfferMeetEditPage),
});
