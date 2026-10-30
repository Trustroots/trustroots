import { createRoute } from '@tanstack/react-router';
import React from 'react';
import Media from '@/modules/pages/client/components/Media.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(routeOptions('/media', () => <Media />));
