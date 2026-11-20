import { createFileRoute } from '@tanstack/react-router';
import FaqTribes from '@/modules/pages/client/components/FaqTribes.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/faq/circles')(
  routeOptions('/faq/circles', FaqTribes),
);
