import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminNostr from '@/modules/admin/client/components/AdminNostr.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/nostr')(
  routeOptions('/admin/nostr', () => <AdminNostr />),
);
