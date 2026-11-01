import { createRoute } from '@tanstack/react-router';
import React from 'react';
import Rules from '@/modules/pages/client/components/Rules.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(routeOptions('/rules', () => <Rules />));
