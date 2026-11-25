import React from 'react';
import Statistics from './components/Statistics.component';
import { useAuth } from '@/modules/core/client/react-app/auth';

export function StatisticsRoute() {
  const { isAuthenticated } = useAuth();
  return <Statistics isAuthenticated={isAuthenticated} />;
}
