import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminHackerspaces from '@/modules/admin/client/components/AdminHackerspaces.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/hackerspaces')(
  routeOptions('/admin/hackerspaces', () => <AdminHackerspaces />),
);
