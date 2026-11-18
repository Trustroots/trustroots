import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import FaqFoundation from '@/modules/pages/client/components/FaqFoundation.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/faq/foundation')(
  routeOptions('/faq/foundation', () => <FaqFoundation />),
);
