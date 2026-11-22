import { createFileRoute } from '@tanstack/react-router';
import Guide from '@/modules/pages/client/components/Guide.component';

export const Route = createFileRoute('/guide')({
  staticData: { title: 'Guide' },
  component: Guide,
});
