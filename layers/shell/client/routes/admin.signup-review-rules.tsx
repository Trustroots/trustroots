import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminSignupReviewRules from '@/modules/admin/client/components/AdminSignupReviewRules';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/signup-review-rules', () => <AdminSignupReviewRules />),
);
