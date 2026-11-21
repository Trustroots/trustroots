import { createFileRoute } from '@tanstack/react-router';
import FaqGeneral from '@/modules/pages/client/components/FaqGeneral.component';

export const Route = createFileRoute('/faq/')({
  staticData: { title: 'FAQ - Site & community' },
  component: FaqGeneral,
});
