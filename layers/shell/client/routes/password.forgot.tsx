import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import ForgotPasswordPage from '@/modules/users/client/components/ForgotPasswordPage.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/password/forgot')(
  routeOptions('/password/forgot', () => <ForgotPasswordPage />),
);
