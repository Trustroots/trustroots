import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminReferenceThreads from '@/modules/admin/client/components/AdminReferenceThreads.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/reference-threads')(
  routeOptions('/admin/reference-threads', () => <AdminReferenceThreads />),
);
