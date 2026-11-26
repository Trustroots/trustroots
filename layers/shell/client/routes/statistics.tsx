import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import Statistics from '@/modules/statistics/client/components/Statistics.component';
import { useAuth } from '@trustroots/core/auth';

function StatisticsRoute() {
  const { isAuthenticated } = useAuth();
  return <Statistics isAuthenticated={isAuthenticated} />;
}

export const Route = createFileRoute('/statistics')({
  staticData: { title: 'Statistics' },
  component: StatisticsRoute,
});
