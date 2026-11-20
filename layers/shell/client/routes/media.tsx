import { createFileRoute } from '@tanstack/react-router';
import Media from '@/modules/pages/client/components/Media.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/media')(
  routeOptions({ title: 'Media' }, Media),
);
