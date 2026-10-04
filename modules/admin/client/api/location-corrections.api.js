import axios from 'axios';

export async function getLocationCorrections() {
  const { data } = await axios.get('/api/admin/location-corrections');
  return data;
}

export async function sendLocationCorrection(userId, key, content) {
  const { data } = await axios.post('/api/admin/location-corrections/send', {
    userId,
    key,
    content,
  });
  return data;
}
