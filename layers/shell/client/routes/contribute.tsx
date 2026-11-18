import { createFileRoute } from '@tanstack/react-router';
import Contribute from '@/modules/pages/client/components/Contribute.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/contribute')(
  routeOptions('/contribute', Contribute),
);
