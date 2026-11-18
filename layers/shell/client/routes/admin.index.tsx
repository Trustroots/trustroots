import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import Admin from '@/modules/admin/client/components/Admin.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/')(
  routeOptions('/admin', () => <Admin />),
);
