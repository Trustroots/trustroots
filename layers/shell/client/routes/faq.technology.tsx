import { createFileRoute } from '@tanstack/react-router';
import FaqTechnology from '@/modules/pages/client/components/FaqTechnology.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/faq/technology')(
  routeOptions({ title: 'FAQ - Technology' }, FaqTechnology),
);
