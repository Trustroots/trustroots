import { createFileRoute } from '@tanstack/react-router';
import Credits from '@/modules/pages/client/components/Credits.component';

export const Route = createFileRoute('/credits')({
  staticData: { title: 'Credits' },
  component: Credits,
});
