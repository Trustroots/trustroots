import axios from 'axios';

export async function searchUsers(search) {
  const { data } = await axios.post('/api/admin/users', { search });
  return data;
}

export async function getUser(id) {
  const { data } = await axios.post('/api/admin/user', { id });
  return data;
}

export async function suspendUser(id) {
  const { data } = await axios.post('/api/admin/user/suspend', { id });
  return data;
}
