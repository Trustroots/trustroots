import { createFileRoute } from '@tanstack/react-router';
import Privacy from '@/modules/pages/client/components/Privacy.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/privacy')(
  routeOptions({ title: 'Privacy policy' }, Privacy),
);
