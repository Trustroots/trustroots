import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminSparkpost from '@/modules/admin/client/components/AdminSparkpost.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/sparkpost')(
  routeOptions('/admin/sparkpost', () => <AdminSparkpost />),
);
