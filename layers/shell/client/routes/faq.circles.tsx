import { createRoute } from '@tanstack/react-router';
import React from 'react';
import FaqTribes from '@/modules/pages/client/components/FaqTribes.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/faq/circles', () => <FaqTribes />),
);
