import axios from '../../../core/client/api/http-client.js';

export async function getAdminDashboard() {
  const { data } = await axios.get('/api/admin/dashboard');
  return data;
}
