import axios from 'axios';

import {
  searchUsers,
  listUsersByLastIpAddress,
  listUsersByRole,
  getUser,
  setUserRole,
} from '@/modules/admin/client/api/users.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('admin users api', () => {
  it('searches users', async () => {
    const data = [{ _id: 'user-1' }];
    axios.post.mockResolvedValueOnce({ data });

    await expect(searchUsers('alice')).resolves.toBe(data);
    expect(axios.post).toHaveBeenCalledWith('/api/admin/users', {
      search: 'alice',
    });
  });

  it('lists users by role', async () => {
    const data = [{ _id: 'user-1' }];
    const options = {
      page: 2,
      sort: { column: 'created', direction: 'descending' },
    };
    axios.post.mockResolvedValueOnce({ data });

    await expect(listUsersByRole('admin', options)).resolves.toBe(data);
    expect(axios.post).toHaveBeenCalledWith('/api/admin/users/by-role', {
      role: 'admin',
      ...options,
    });

    axios.post.mockResolvedValueOnce({ data });
    await expect(listUsersByRole('volunteer')).resolves.toBe(data);
    expect(axios.post).toHaveBeenLastCalledWith('/api/admin/users/by-role', {
      role: 'volunteer',
    });
  });

  it('lists users by their exact last IP address', async () => {
    const data = [{ _id: 'user-1' }];
    const options = { page: 3 };
    axios.post.mockResolvedValueOnce({ data });

    await expect(
      listUsersByLastIpAddress('203.0.113.10', options),
    ).resolves.toBe(data);
    expect(axios.post).toHaveBeenCalledWith(
      '/api/admin/users/by-last-ip-address',
      { ipAddress: '203.0.113.10', page: 3 },
    );

    axios.post.mockResolvedValueOnce({ data });
    await expect(
      listUsersByLastIpAddress('203.0.113.20'),
    ).resolves.toBe(data);
    expect(axios.post).toHaveBeenLastCalledWith(
      '/api/admin/users/by-last-ip-address',
      { ipAddress: '203.0.113.20' },
    );
  });

  it('gets a single user by id', async () => {
    const data = { _id: 'user-1' };
    axios.post.mockResolvedValueOnce({ data });

    await expect(getUser('user-1')).resolves.toBe(data);
    expect(axios.post).toHaveBeenCalledWith('/api/admin/user', {
      id: 'user-1',
    });
  });

  it('changes a user role', async () => {
    const data = { _id: 'user-1', roles: ['admin'] };
    axios.post.mockResolvedValueOnce({ data });

    await expect(setUserRole('user-1', 'admin')).resolves.toBe(data);
    expect(axios.post).toHaveBeenCalledWith('/api/admin/user/change-role', {
      id: 'user-1',
      role: 'admin',
    });
  });
});
