import { createFileRoute } from '@tanstack/react-router';
import FaqGeneral from '@/modules/pages/client/components/FaqGeneral.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/faq/')(
  routeOptions({ title: 'FAQ - Site & community' }, FaqGeneral),
);
