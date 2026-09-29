import axios from 'axios';

export async function getReferenceThreads() {
  const { data } = await axios.get('/api/admin/reference-threads');
  return data;
}
