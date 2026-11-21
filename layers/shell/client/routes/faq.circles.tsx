import { createFileRoute } from '@tanstack/react-router';
import FaqTribes from '@/modules/pages/client/components/FaqTribes.component';

export const Route = createFileRoute('/faq/circles')({
  staticData: { title: 'FAQ - Circles' },
  component: FaqTribes,
});
