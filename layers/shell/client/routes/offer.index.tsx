import { createFileRoute } from '@tanstack/react-router';
import OfferRedirectPage from '@/modules/offers/client/components/OfferRedirectPage.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/offer/')(
  routeOptions('/offer', OfferRedirectPage),
);
