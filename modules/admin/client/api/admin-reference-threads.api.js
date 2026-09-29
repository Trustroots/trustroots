import axios from '../../../core/client/api/http-client.js';

export async function getReferenceThreads() {
  const { data } = await axios.get('/api/admin/reference-threads');
  return data;
}
