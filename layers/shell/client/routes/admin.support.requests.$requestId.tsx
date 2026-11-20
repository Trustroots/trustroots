import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import SupportInbox from '@/modules/admin/client/components/Support.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/support/requests/$requestId')(
  routeOptions('/admin/support/requests/:requestId', () => <SupportInbox />),
);
