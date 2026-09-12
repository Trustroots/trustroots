import axios from 'axios';

export async function forgotPassword(credentials) {
  const { data } = await axios.post('/api/auth/forgot', credentials);
  return data;
}
