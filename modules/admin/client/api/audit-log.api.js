import axios from 'axios';

export async function getAuditLog() {
  const { data } = await axios.get('/api/admin/audit-log');
  return data;
}
