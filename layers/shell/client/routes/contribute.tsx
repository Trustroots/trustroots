import { createFileRoute } from '@tanstack/react-router';
import Contribute from '@/modules/pages/client/components/Contribute.component';

export const Route = createFileRoute('/contribute')({
  staticData: { title: 'Contribute' },
  component: Contribute,
});
