import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '../route-options';

export const Route = createFileRoute('/profile/$username/overview')({
  staticData: { title: 'Profile overview', noScrollingTop: true },
  beforeLoad: requireAuth,
});
