import axios from 'axios';

export async function searchUsers(search) {
  const { data } = await axios.post('/api/admin/users', { search });
  return data;
}

export async function listUsersByRole(role) {
  const { data } = await axios.post('/api/admin/users/by-role', { role });
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
