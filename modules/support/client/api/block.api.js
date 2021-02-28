import axios from 'axios';

export async function block(username) {
  return await axios.post(`/api/blocked-users/${username}`);
}
