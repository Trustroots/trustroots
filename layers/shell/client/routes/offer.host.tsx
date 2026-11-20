import { createFileRoute } from '@tanstack/react-router';
import OfferHostPage from '@/modules/offers/client/components/OfferHostPage.component';
import { requireAuth, withUser } from '../route-options';

export const Route = createFileRoute('/offer/host')({
  staticData: { title: 'Host travellers', footerHidden: true },
  beforeLoad: requireAuth,
  component: withUser(OfferHostPage),
});
