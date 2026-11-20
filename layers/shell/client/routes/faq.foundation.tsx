import { createFileRoute } from '@tanstack/react-router';
import FaqFoundation from '@/modules/pages/client/components/FaqFoundation.component';

export const Route = createFileRoute('/faq/foundation')({
  staticData: { title: 'FAQ - Foundation' },
  component: FaqFoundation,
});
