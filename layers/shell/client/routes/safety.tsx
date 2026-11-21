import { createFileRoute } from '@tanstack/react-router';
import Safety from '@/modules/pages/client/components/Safety.component';

export const Route = createFileRoute('/safety')({
  staticData: { title: 'Safety' },
  component: Safety,
});
