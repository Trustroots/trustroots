import axios, { type AxiosResponse } from 'axios';

import {
  listMemberships,
  join,
  leave,
  read,
  get,
  listMembers,
  type CircleMemberGroups,
  type MembershipUpdate,
  type TribeSummary,
} from '@/modules/tribes/client/api/tribes.api';

const axiosMock = jest.mocked(axios);

function response<T>(data: T): AxiosResponse<T> {
  const { AxiosHeaders: ActualAxiosHeaders } =
    jest.requireActual<typeof import('axios')>('axios');
  const headers = new ActualAxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

afterEach(() => {
  jest.clearAllMocks();
});

describe('tribes api', () => {
  it("lists the current member's circles", async () => {
    const memberships: MembershipUpdate[] = [
      {
        tribe: {
          _id: 'tribe-1',
          slug: 'sample-circle',
          label: 'Sample Circle',
          count: 3,
        },
      },
    ];
    axiosMock.get.mockResolvedValueOnce(response(memberships));

    await expect(listMemberships()).resolves.toBe(memberships);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/users/memberships');
  });

  it('joins a tribe', async () => {
    const updated: MembershipUpdate = {
      user: {
        _id: 'user-1',
        username: 'sample-member',
        displayName: 'Sample Member',
      },
    };
    axiosMock.post.mockResolvedValueOnce(response(updated));

    await expect(join('tribe-1')).resolves.toBe(updated);
    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/users/memberships/tribe-1',
    );
  });

  it('leaves a tribe', async () => {
    const updated: MembershipUpdate = {
      user: {
        _id: 'user-1',
        username: 'sample-member',
        displayName: 'Sample Member',
      },
    };
    axiosMock.delete.mockResolvedValueOnce(response(updated));

    await expect(leave('tribe-1')).resolves.toBe(updated);
    expect(axiosMock.delete).toHaveBeenCalledWith(
      '/api/users/memberships/tribe-1',
    );
  });

  it('reads tribes with the default limit', async () => {
    const tribes: TribeSummary[] = [
      {
        _id: 'tribe-1',
        slug: 'sample-circle',
        label: 'Sample Circle',
        count: 3,
      },
    ];
    axiosMock.get.mockResolvedValueOnce(response(tribes));

    await expect(read()).resolves.toBe(tribes);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/tribes', {
      params: { limit: 150 },
    });
  });

  it('reads tribes with a custom limit', async () => {
    axiosMock.get.mockResolvedValueOnce(response<TribeSummary[]>([]));

    await read({ limit: 10 });
    expect(axiosMock.get).toHaveBeenCalledWith('/api/tribes', {
      params: { limit: 10 },
    });
  });

  it('gets a single tribe by slug', async () => {
    const tribe: TribeSummary = {
      _id: 'tribe-1',
      slug: 'sample-circle',
      label: 'Sample Circle',
      count: 3,
    };
    axiosMock.get.mockResolvedValueOnce(response(tribe));

    await expect(get('hitchhikers')).resolves.toBe(tribe);
    expect(axiosMock.get).toHaveBeenCalledWith('/api/tribes/hitchhikers');
  });

  it('lists bounded, deduplicated discovery groups for a circle', async () => {
    const members: CircleMemberGroups = {
      contacts: [],
      recommenders: [],
      active: [],
    };
    axiosMock.get.mockResolvedValueOnce(response(members));

    await expect(listMembers('hitchhikers')).resolves.toBe(members);
    expect(axiosMock.get).toHaveBeenCalledWith(
      '/api/tribes/hitchhikers/members',
    );
  });
});
