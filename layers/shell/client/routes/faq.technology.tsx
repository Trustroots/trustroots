import { createFileRoute } from '@tanstack/react-router';
import FaqTechnology from '@/modules/pages/client/components/FaqTechnology.component';

export const Route = createFileRoute('/faq/technology')({
  staticData: { title: 'FAQ - Technology' },
  component: FaqTechnology,
});
