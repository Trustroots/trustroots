import React from 'react';
import Statistics from './components/Statistics.component';
import { useAuth } from '@trustroots/core/auth';

export function StatisticsRoute() {
  const { isAuthenticated } = useAuth();
  return <Statistics isAuthenticated={isAuthenticated} />;
}
