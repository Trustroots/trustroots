import { createRoute } from '@tanstack/react-router';
import React from 'react';
import FaqFoundation from '@/modules/pages/client/components/FaqFoundation.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/faq/foundation', () => <FaqFoundation />),
);
