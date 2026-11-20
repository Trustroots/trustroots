import { createFileRoute } from '@tanstack/react-router';
import Greeters from '@/modules/pages/client/components/Greeters.component';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/team/greeters')(
  routeOptions('/team/greeters', withUser(Greeters)),
);
