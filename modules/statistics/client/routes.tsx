import React from 'react';

import type { RouteRender } from '@/modules/core/client/react-app/route-render';
import Statistics from '@/modules/statistics/client/components/Statistics.component';

export const statisticsRoutes: Record<string, RouteRender> = {
  '/statistics': ({ user }) =>
    React.createElement(Statistics, { isAuthenticated: Boolean(user) }),
};
