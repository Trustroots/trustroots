import { createFileRoute } from '@tanstack/react-router';
import { SafetyPage } from '@/modules/pages/client/route-views';

export const Route = createFileRoute('/safety')({
  staticData: { title: 'Safety' },
  component: SafetyPage,
});
