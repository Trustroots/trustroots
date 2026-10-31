import { createRoute } from '@tanstack/react-router';
import React from 'react';
import SigninPage from '@/modules/users/client/components/SigninPage.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(routeOptions('/signin', () => <SigninPage />));
