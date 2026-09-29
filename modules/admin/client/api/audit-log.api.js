import axios from '../../../core/client/api/http-client.js';

export async function getAuditLog() {
  const { data } = await axios.get('/api/admin/audit-log');
  return data;
}
