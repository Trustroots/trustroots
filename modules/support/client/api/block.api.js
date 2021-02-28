import axios from 'axios';

export async function block(username) {
  alert('alert2' + username);
  return await axios.post(`/api/blocked-users/${username}`);
}
