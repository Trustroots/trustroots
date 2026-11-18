import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import SearchUsers from '@/modules/search/client/components/SearchUsers.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/search/members')(
  routeOptions('/search/members', () => <SearchUsers />),
);
