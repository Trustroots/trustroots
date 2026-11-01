import { createRoute } from '@tanstack/react-router';
import React from 'react';
import Guide from '@/modules/pages/client/components/Guide.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(routeOptions('/guide', () => <Guide />));
