import axios from 'axios';

export interface AdminAuditLogEntry {
  _id: string;
  route?: string;
  user?: Record<string, unknown>;
  ip?: string;
  date?: string;
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
}

export async function getAuditLog(): Promise<AdminAuditLogEntry[]> {
  const { data } = await axios.get('/api/admin/audit-log');
  return data as AdminAuditLogEntry[];
}
