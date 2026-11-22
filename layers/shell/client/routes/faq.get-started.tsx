import { createFileRoute } from '@tanstack/react-router';
import FaqGetStarted from '@/modules/pages/client/components/FaqGetStarted.component';

export const Route = createFileRoute('/faq/get-started')({
  staticData: { title: 'FAQ - Get Started' },
  component: FaqGetStarted,
});
