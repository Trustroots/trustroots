import { createRoute } from '@tanstack/react-router';
import React from 'react';
import FaqGeneral from '@/modules/pages/client/components/FaqGeneral.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(routeOptions('/faq', () => <FaqGeneral />));
