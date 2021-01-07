import axios from 'axios';

export async function send(request) {
  return await axios.post('/api/support', request);
}
