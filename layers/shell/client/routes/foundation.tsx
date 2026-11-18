import { createFileRoute } from '@tanstack/react-router';
import Foundation from '@/modules/pages/client/components/Foundation.component';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/foundation')(
  routeOptions('/foundation', withUser(Foundation)),
);
