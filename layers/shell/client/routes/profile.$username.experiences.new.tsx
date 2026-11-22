import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '../route-options';

export const Route = createFileRoute('/profile/$username/experiences/new')({
  staticData: { title: 'Share your experience', noScrollingTop: true },
  beforeLoad: requireAuth,
});
