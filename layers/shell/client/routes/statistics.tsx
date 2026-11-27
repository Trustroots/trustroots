import { createFileRoute } from '@tanstack/react-router';
import { StatisticsRoute } from '@trustroots/statistics/route-views';

export const Route = createFileRoute('/statistics')({
  staticData: { title: 'Statistics' },
  component: StatisticsRoute,
});
