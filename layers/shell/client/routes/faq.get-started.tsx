import { createFileRoute } from '@tanstack/react-router';
import FaqGetStarted from '@/modules/pages/client/components/FaqGetStarted.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/faq/get-started')(
  routeOptions({ title: 'FAQ - Get Started' }, FaqGetStarted),
);
