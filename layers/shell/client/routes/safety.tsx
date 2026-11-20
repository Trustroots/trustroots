import { createFileRoute } from '@tanstack/react-router';
import Safety from '@/modules/pages/client/components/Safety.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/safety')(
  routeOptions({ title: 'Safety' }, Safety),
);
