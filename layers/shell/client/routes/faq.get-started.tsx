import { createRoute } from '@tanstack/react-router';
import React from 'react';
import FaqGetStarted from '@/modules/pages/client/components/FaqGetStarted.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/faq/get-started', () => <FaqGetStarted />),
);
