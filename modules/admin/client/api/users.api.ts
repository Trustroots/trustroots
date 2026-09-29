import axios from '../../../core/client/api/http-client.js';

export interface UserSearchOptions {
  page?: number;
  role?: string;
  sort?: { column: string; direction: string };
  [key: string]: string | number | boolean | null | undefined | object;
}

export async function searchUsers(
  search: string,
  options: UserSearchOptions = {},
) {
  const { data } = await axios.post('/api/admin/users', {
    search,
    ...options,
  });
  return data;
}

export async function listUsersByRole(
  role: string,
  options: UserSearchOptions = {},
) {
  const { data } = await axios.post('/api/admin/users/by-role', {
    role,
    ...options,
  });
  return data;
}

export async function listUsersByLastIpAddress(
  ipAddress: string | null,
  options: UserSearchOptions = {},
) {
  const { data } = await axios.post('/api/admin/users/by-last-ip-address', {
    ipAddress,
    ...options,
  });
  return data;
}

export async function getUser(id: string) {
  const { data } = await axios.post('/api/admin/user', { id });
  return data;
}

export async function setUserRole(id: string, role: string, action?: string) {
  const { data } = await axios.post('/api/admin/user/change-role', {
    id,
    role,
    ...(action === undefined ? {} : { action }),
  });
  return data;
}
