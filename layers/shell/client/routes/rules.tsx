import { createFileRoute } from '@tanstack/react-router';
import Rules from '@/modules/pages/client/components/Rules.component';

export const Route = createFileRoute('/rules')({
  staticData: { title: 'Rules' },
  component: Rules,
});
