import axios from 'axios';

export async function block(username) {
  return await axios.put(`/api/blocked-users/${username}`);
}
