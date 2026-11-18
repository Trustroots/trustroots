import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import Statistics from '@/modules/statistics/client/components/Statistics.component';
import { useAuth } from '@/modules/core/client/react-app/auth';
import { routeOptions } from '../route-options';

function StatisticsRoute() {
  const { isAuthenticated } = useAuth();
  return <Statistics isAuthenticated={isAuthenticated} />;
}

export const Route = createFileRoute('/statistics')(
  routeOptions('/statistics', StatisticsRoute),
);
