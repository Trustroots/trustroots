import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import Safety from '@/modules/pages/client/components/Safety.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/safety')(
  routeOptions('/safety', () => <Safety />),
);
