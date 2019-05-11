import axios from 'axios';

export async function searchUsers(query) {
  const { data } = await axios.post('/api/admin/users', { 'search': query });
  return data;
}

export async function getUser(id) {
  const { data } = await axios.post('/api/admin/user', { id });
  return data;
}
