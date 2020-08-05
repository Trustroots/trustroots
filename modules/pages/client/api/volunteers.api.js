import axios from 'axios';

export async function getVolunteers() {
  const { data } = await axios.get('/api/volunteers');
  return data;
}
