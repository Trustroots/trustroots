import { createFileRoute } from '@tanstack/react-router';
import AdminSignupReviewRules from '@/modules/admin/client/components/AdminSignupReviewRules';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/signup-review-rules')({
  staticData: { title: 'Admin - Signup watchlist', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminSignupReviewRules,
});
