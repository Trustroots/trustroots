import { createFileRoute } from '@tanstack/react-router';
import { redirectTo } from '../route-options';

// The /offer policy redirects to /offer/host before this route renders.
export const Route = createFileRoute('/offer/')({
  staticData: { title: 'Host travellers' },
  beforeLoad: redirectTo('/offer/host'),
});
