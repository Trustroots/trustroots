import { createFileRoute } from '@tanstack/react-router';
import { SafetyPage } from '@trustroots/pages/route-views';

export const Route = createFileRoute('/safety')({
  staticData: { title: 'Safety' },
  component: SafetyPage,
});
