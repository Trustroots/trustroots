import { createRoute } from '@tanstack/react-router';
import React from 'react';
import SignupPage from '@/modules/users/client/components/SignupPage.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(routeOptions('/signup', () => <SignupPage />));
