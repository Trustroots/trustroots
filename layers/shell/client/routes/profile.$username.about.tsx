import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '../route-options';

export const Route = createFileRoute('/profile/$username/about')({
  staticData: { title: 'Profile', noScrollingTop: true },
  beforeLoad: requireAuth,
});
