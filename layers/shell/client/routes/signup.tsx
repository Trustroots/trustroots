import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import SignupPage from '@/modules/users/client/components/SignupPage.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/signup')(
  routeOptions('/signup', () => <SignupPage />),
);
