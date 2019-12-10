import axios from 'axios';

export async function join(tribeId) {
  const { data } = await axios.post(`/api/users/memberships/${tribeId}`);
  return data;
}

export async function leave(tribeId) {
  const { data } = await axios.delete(`/api/users/memberships/${tribeId}`);
  return data;
}

export async function read() {
  const { data } = await axios.get(`/api/tribes?limit=50`);
  return data;
}
