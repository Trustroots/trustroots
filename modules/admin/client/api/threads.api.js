import axios from 'axios';

export async function getThreads(userId) {
  const { data } = await axios.post('/api/admin/threads', { userId });
  return data;
}
