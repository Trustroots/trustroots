import axios, { type AxiosResponse } from 'axios';

import {
  searchUsers,
  listUsersByLastIpHash,
  listUsersByRole,
  getUser,
  getUserByUsername,
  setUserRole,
  deleteMember,
  unsuspendMember,
  type UserSearchOptions,
} from '@/modules/admin/client/api/users.api';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock'),
);

const axiosMock = jest.mocked(axios);

function response<T>(data: T): AxiosResponse<T> {
  const { AxiosHeaders: ActualAxiosHeaders } =
    jest.requireActual<typeof import('axios')>('axios');
  const headers = new ActualAxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('admin users api', () => {
  it('searches users', async () => {
    const data = [{ _id: 'user-1' }];
    axiosMock.post.mockResolvedValueOnce(response(data));

    await expect(searchUsers('alice')).resolves.toBe(data);
    expect(axiosMock.post).toHaveBeenCalledWith('/api/admin/users', {
      search: 'alice',
    });
  });

  it('lists users by role', async () => {
    const data = [{ _id: 'user-1' }];
    const options: UserSearchOptions = {
      page: 2,
      sort: { column: 'created', direction: 'descending' },
    };
    axiosMock.post.mockResolvedValueOnce(response(data));

    await expect(listUsersByRole('admin', options)).resolves.toBe(data);
    expect(axiosMock.post).toHaveBeenCalledWith('/api/admin/users/by-role', {
      role: 'admin',
      ...options,
    });

    axiosMock.post.mockResolvedValueOnce(response(data));
    await expect(listUsersByRole('volunteer')).resolves.toBe(data);
    expect(axiosMock.post).toHaveBeenLastCalledWith(
      '/api/admin/users/by-role',
      {
        role: 'volunteer',
      },
    );
  });

  it('lists users by their exact last IP address', async () => {
    const data = [{ _id: 'user-1' }];
    const options: UserSearchOptions = { page: 3 };
    axiosMock.post.mockResolvedValueOnce(response(data));

    await expect(
      listUsersByLastIpHash(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        options,
      ),
    ).resolves.toBe(data);
    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/admin/users/by-last-ip-hash',
      {
        ipHash:
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        page: 3,
      },
    );

    axiosMock.post.mockResolvedValueOnce(response(data));
    await expect(
      listUsersByLastIpHash(
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      ),
    ).resolves.toBe(data);
    expect(axiosMock.post).toHaveBeenLastCalledWith(
      '/api/admin/users/by-last-ip-hash',
      {
        ipHash:
          'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    );
  });

  it('gets a single user by id', async () => {
    const data = { _id: 'user-1' };
    axiosMock.post.mockResolvedValueOnce(response(data));

    await expect(getUser('user-1')).resolves.toBe(data);
    expect(axiosMock.post).toHaveBeenCalledWith('/api/admin/user', {
      id: 'user-1',
    });
  });

  it('gets a single user by exact username', async () => {
    const data = { _id: 'user-1' };
    axiosMock.post.mockResolvedValueOnce(response(data));

    await expect(getUserByUsername('common-name-member')).resolves.toBe(data);
    expect(axiosMock.post).toHaveBeenCalledWith('/api/admin/user', {
      username: 'common-name-member',
    });
  });

  it('passes explicit role removals to the API', async () => {
    axiosMock.post.mockResolvedValueOnce(response({}));
    await setUserRole('member-id', 'welcome-team', 'remove');
    expect(axiosMock.post).toHaveBeenCalledWith('/api/admin/user/change-role', {
      id: 'member-id',
      role: 'welcome-team',
      action: 'remove',
    });
  });

  it('changes a user role', async () => {
    const data = { _id: 'user-1', roles: ['admin'] };
    axiosMock.post.mockResolvedValueOnce(response(data));

    await expect(setUserRole('user-1', 'admin')).resolves.toBe(data);
    expect(axiosMock.post).toHaveBeenCalledWith('/api/admin/user/change-role', {
      id: 'user-1',
      role: 'admin',
    });
  });

  it('deletes a suspended member with the supplied confirmation details', async () => {
    const data = { success: true };
    axiosMock.post.mockResolvedValueOnce(response(data));
    await expect(
      deleteMember('member-id', 'alice', 'confirmed request', ['spam']),
    ).resolves.toBe(data);
    expect(axiosMock.post).toHaveBeenCalledWith('/api/admin/user/delete', {
      id: 'member-id',
      username: 'alice',
      reason: 'confirmed request',
      keywords: ['spam'],
    });
  });

  it('defaults deletion audit keywords to an empty list', async () => {
    axiosMock.post.mockResolvedValueOnce(response({ success: true }));
    await deleteMember('member-id', 'alice', 'confirmed request');
    expect(axiosMock.post).toHaveBeenCalledWith('/api/admin/user/delete', {
      id: 'member-id',
      username: 'alice',
      reason: 'confirmed request',
      keywords: [],
    });
  });
});

it('sends explicit unsuspension confirmation and the administrator reason', async () => {
  const data = { changed: true, message: 'Member unsuspended.' };
  axiosMock.post.mockResolvedValueOnce(response(data));
  await expect(
    unsuspendMember('member-1', 'A fictional review.'),
  ).resolves.toEqual(data);
  expect(axiosMock.post).toHaveBeenCalledWith('/api/admin/user/unsuspend', {
    id: 'member-1',
    reason: 'A fictional review.',
    confirmed: true,
  });
});
