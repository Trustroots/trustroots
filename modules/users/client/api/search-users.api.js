import axios from '../../../core/client/api/http-client.js';

export async function searchUsers(query) {
  return await axios.get(`/api/users?search=${query}`);
}
