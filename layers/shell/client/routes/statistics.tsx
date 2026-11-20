import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import Statistics from '@/modules/statistics/client/components/Statistics.component';
import { routeOptions, type RouteContext } from '../route-options';

function renderStatistics({ user }: RouteContext) {
  return React.createElement(Statistics, { isAuthenticated: Boolean(user) });
}

export const Route = createFileRoute('/statistics')(
  routeOptions('/statistics', renderStatistics),
);
