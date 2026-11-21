import { createFileRoute } from '@tanstack/react-router';
import FaqBugsAndFeatures from '@/modules/pages/client/components/FaqBugsAndFeatures.component';

export const Route = createFileRoute('/faq/bugs-and-features')({
  staticData: { title: 'FAQ - Bugs & Features' },
  component: FaqBugsAndFeatures,
});
