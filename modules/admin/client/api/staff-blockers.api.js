import axios from 'axios';

export async function getStaffBlockers() {
  const { data } = await axios.get('/api/admin/staff-blockers');
  return data;
}
