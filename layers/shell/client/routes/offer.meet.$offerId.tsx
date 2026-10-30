import { createRoute } from '@tanstack/react-router';
import { offersRoutes } from '@/modules/offers/client/routes';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/offer/meet/:offerId', offersRoutes['/offer/meet/:offerId']),
);
