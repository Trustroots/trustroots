import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import FlaggedMembers from '@/modules/admin/client/components/FlaggedMembers.component';
import { routeOptions } from '../route-options';
export const Route = createFileRoute('/admin/support/flagged')(
  routeOptions('/admin/support/flagged', () => <FlaggedMembers />),
);
