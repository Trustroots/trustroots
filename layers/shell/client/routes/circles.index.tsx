import { createFileRoute } from '@tanstack/react-router';
import { circlesQuery } from '@/modules/tribes/client/api/circle-queries';
import { TribesPageRoute } from '@/modules/tribes/client/route-views';

export const Route = createFileRoute('/circles/')({
  staticData: { title: 'Circles' },
  component: TribesPageRoute,
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(circlesQuery(context.user?._id));
  },
});
