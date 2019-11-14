import axios from 'axios';

export async function join(tribeId) {
  await axios.post(`/api/users/memberships/${tribeId}`, { tribeId });
}

export async function leave(tribeId) {
  await axios.delete(`/api/users/memberships/${tribeId}`);
}
