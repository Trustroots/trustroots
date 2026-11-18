import { createFileRoute } from '@tanstack/react-router';
import FaqBugsAndFeatures from '@/modules/pages/client/components/FaqBugsAndFeatures.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/faq/bugs-and-features')(
  routeOptions('/faq/bugs-and-features', FaqBugsAndFeatures),
);
