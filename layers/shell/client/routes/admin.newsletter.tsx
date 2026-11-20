import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminNewsletter from '@/modules/admin/client/components/AdminNewsletter.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/newsletter')(
  routeOptions('/admin/newsletter', () => <AdminNewsletter />),
);
