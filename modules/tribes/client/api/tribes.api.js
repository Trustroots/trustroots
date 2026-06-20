import axios from 'axios';

export async function join(tribeId) {
  const { data } = await axios.post(`/api/users/memberships/${tribeId}`);
  return data;
}

export async function leave(tribeId) {
  const { data } = await axios.delete(`/api/users/memberships/${tribeId}`);
  return data;
}

/**
 * @param {Number} limit
 * @param {String} sortBy Values count|alphabetically. Sort either by count or by alphabetical label order; defaults to count.
 */
export async function read({ limit = 150 } = {}) {
  const { data } = await axios.get('/api/tribes', { params: { limit } });
  return data;
}

export async function get(slug) {
  const { data } = await axios.get(`/api/tribes/${slug}`);
  return data;
}
