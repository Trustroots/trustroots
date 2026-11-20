import { createFileRoute } from '@tanstack/react-router';
import AdminSignupReviewRules from '@/modules/admin/client/components/AdminSignupReviewRules';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/signup-review-rules')(
  routeOptions(adminPolicy('Admin - Signup watchlist'), AdminSignupReviewRules),
);
