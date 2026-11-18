import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminEmailReplies from '@/modules/admin/client/components/AdminEmailReplies.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/email-replies')(
  routeOptions('/admin/email-replies', () => <AdminEmailReplies />),
);
