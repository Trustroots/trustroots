import axios from '../../../core/client/api/http-client.js';

export async function getThreads({ userId = '', username = '' }) {
  const { data } = await axios.post('/api/admin/threads', { userId, username });
  return data;
}
