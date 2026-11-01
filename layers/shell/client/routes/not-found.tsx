import { createRoute } from '@tanstack/react-router';
import React from 'react';
import NotFoundPage from '@/modules/core/client/components/NotFoundPage.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/not-found', () => <NotFoundPage />),
);
