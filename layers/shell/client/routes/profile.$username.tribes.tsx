import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '../route-options';

export const Route = createFileRoute('/profile/$username/tribes')({
  staticData: { title: 'Profile tribes', noScrollingTop: true },
  beforeLoad: requireAuth,
});
