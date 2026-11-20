import { createFileRoute } from '@tanstack/react-router';
import OfferMeetListPage from '@/modules/offers/client/components/OfferMeetListPage.component';
import { requireAuth, withUser } from '../route-options';

export const Route = createFileRoute('/offer/meet/')({
  staticData: { title: 'Meet' },
  beforeLoad: requireAuth,
  component: withUser(OfferMeetListPage),
});
