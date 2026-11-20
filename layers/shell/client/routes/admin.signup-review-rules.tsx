import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminSignupReviewRules from '@/modules/admin/client/components/AdminSignupReviewRules';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/signup-review-rules')(
  routeOptions('/admin/signup-review-rules', () => <AdminSignupReviewRules />),
);
