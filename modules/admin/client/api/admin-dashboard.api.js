import axios from 'axios';

export async function getAdminDashboard() {
  const { data } = await axios.get('/api/admin/dashboard');
  return data;
}
