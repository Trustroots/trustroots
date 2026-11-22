import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '../route-options';

export const Route = createFileRoute('/profile/$username/accommodation')({
  staticData: { title: 'Profile accommodation', noScrollingTop: true },
  beforeLoad: requireAuth,
});
