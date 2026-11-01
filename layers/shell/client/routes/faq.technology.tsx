import { createRoute } from '@tanstack/react-router';
import React from 'react';
import FaqTechnology from '@/modules/pages/client/components/FaqTechnology.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/faq/technology', () => <FaqTechnology />),
);
