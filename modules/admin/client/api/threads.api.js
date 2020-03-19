import axios from 'axios';

export async function getThreads({ userId = '', username = '' }) {
  const { data } = await axios.post('/api/admin/threads', { userId, username });
  return data;
}
