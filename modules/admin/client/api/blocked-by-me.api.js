import axios from 'axios';

export async function getMembersWhoBlockedMe() {
  const { data } = await axios.get('/api/admin/blocked-by-me');
  return data;
}
