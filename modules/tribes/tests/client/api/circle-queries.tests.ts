import { QueryClient } from '@tanstack/react-query';

import {
  circleQuery,
  circlesQuery,
  setCachedCircle,
} from '@/modules/tribes/client/api/circle-queries';
import type { TribeSummary } from '@/modules/tribes/client/api/tribes.api';

const walkers: TribeSummary = {
  _id: 'circle-1',
  slug: 'walkers',
  label: 'Walkers',
  count: 2,
};
const readers: TribeSummary = {
  _id: 'circle-2',
  slug: 'readers',
  label: 'Readers',
  count: 5,
};

describe('circle queries', () => {
  it('keeps each viewer in its own cache entry', () => {
    expect(circlesQuery('member-1').queryKey).not.toEqual(
      circlesQuery().queryKey,
    );
    expect(circleQuery('walkers', 'member-1').queryKey).not.toEqual(
      circleQuery('walkers').queryKey,
    );
  });

  it('puts a joined circle into every cached list and detail', () => {
    const client = new QueryClient();
    const never = () => new Promise<never>(() => {});
    client.setQueryData(circlesQuery().queryKey, [walkers, readers]);
    client.setQueryData(circlesQuery('member-1').queryKey, [walkers]);
    client.setQueryData(circleQuery('walkers', 'member-1').queryKey, walkers);
    client.setQueryData(circleQuery('readers', 'member-1').queryKey, readers);
    void client.prefetchQuery({
      queryKey: ['circles', 'loading'],
      queryFn: never,
    });
    void client.prefetchQuery({
      queryKey: ['circle', 'loading'],
      queryFn: never,
    });

    setCachedCircle(client, { ...walkers, count: 3 });

    expect(client.getQueryData(circlesQuery().queryKey)).toEqual([
      { ...walkers, count: 3 },
      readers,
    ]);
    expect(client.getQueryData(circlesQuery('member-1').queryKey)).toEqual([
      { ...walkers, count: 3 },
    ]);
    expect(
      client.getQueryData(circleQuery('walkers', 'member-1').queryKey),
    ).toEqual({ ...walkers, count: 3 });
    expect(
      client.getQueryData(circleQuery('readers', 'member-1').queryKey),
    ).toBe(readers);
    expect(client.getQueryData(['circles', 'loading'])).toBeUndefined();
    expect(client.getQueryData(['circle', 'loading'])).toBeUndefined();
  });
});
