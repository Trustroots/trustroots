import { createFileRoute } from '@tanstack/react-router';
import { StatisticsRoute } from '@/modules/statistics/client/route-views';

export const Route = createFileRoute('/statistics')({
  staticData: { title: 'Statistics' },
  component: StatisticsRoute,
});
