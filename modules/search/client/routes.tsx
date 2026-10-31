import React from 'react';

import {
  renderWithUser,
  type RouteRender,
} from '@/modules/core/client/react-app/route-render';
import SearchUsers from '@/modules/search/client/components/SearchUsers.component';
import SearchPage from '@/modules/search/client/components/SearchPage.component';

export const searchRoutes: Record<string, RouteRender> = {
  '/search': renderWithUser(SearchPage),
  '/search/members': () => <SearchUsers />,
};
