import { createRoute } from '@tanstack/react-router';
import React from 'react';
import FaqBugsAndFeatures from '@/modules/pages/client/components/FaqBugsAndFeatures.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/faq/bugs-and-features', () => <FaqBugsAndFeatures />),
);
