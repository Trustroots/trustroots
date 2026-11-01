import { createRoute } from '@tanstack/react-router';
import Foundation from '@/modules/pages/client/components/Foundation.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createRoute(
  routeOptions('/foundation', renderWithUser(Foundation)),
);
