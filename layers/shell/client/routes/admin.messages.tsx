import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminMessages from '@/modules/admin/client/components/AdminMessages.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/messages')(
  routeOptions('/admin/messages', () => <AdminMessages />),
);
