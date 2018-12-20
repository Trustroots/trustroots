import axios from '@/config/lib/axios';

export async function searchUsers(query) {
  return await axios.get(`/api/users?search=${query}`);
}
