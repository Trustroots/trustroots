import axios from '../../../core/client/api/http-client.js';

export async function getVolunteers() {
  const { data } = await axios.get('/api/volunteers');
  return data;
}
