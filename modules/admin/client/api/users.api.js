import axios from 'axios';

export async function searchUsers(search, options = {}) {
  const { data } = await axios.post('/api/admin/users', {
    search,
    ...options,
  });
  return data;
}

export async function listUsersByRole(role, options = {}) {
  const { data } = await axios.post('/api/admin/users/by-role', {
    role,
    ...options,
  });
  return data;
}

export async function listUsersByLastIpAddress(ipAddress, options = {}) {
  const { data } = await axios.post('/api/admin/users/by-last-ip-address', {
    ipAddress,
    ...options,
  });
  return data;
}

export async function getUser(id) {
  const { data } = await axios.post('/api/admin/user', { id });
  return data;
}

export async function setUserRole(id, role) {
  const { data } = await axios.post('/api/admin/user/change-role', {
    id,
    role,
  });
  return data;
}
