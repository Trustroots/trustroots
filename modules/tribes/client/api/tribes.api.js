import axios from 'axios';

export async function join(tribeId) {
  const { data } = await axios.post(`/api/users/memberships/${tribeId}`);
  return data;
}

export async function leave(tribeId) {
  const { data } = await axios.delete(`/api/users/memberships/${tribeId}`);
  return data;
}

export async function read({ limit = 50 } = {}) {
  const { data } = await axios.get('/api/tribes', { params: { limit } });
  return data;
}

export async function get(slug) {
  const { data } = await axios.get(`/api/tribes/${slug}`);
  return data;
}
