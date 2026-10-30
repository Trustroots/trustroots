import { createRoute } from '@tanstack/react-router';
import React from 'react';
import SearchUsers from '@/modules/search/client/components/SearchUsers.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/search/members', () => <SearchUsers />),
);
