import { createFileRoute } from '@tanstack/react-router';
import Foundation from '@/modules/pages/client/components/Foundation.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createFileRoute('/foundation')(
  routeOptions('/foundation', renderWithUser(Foundation)),
);
