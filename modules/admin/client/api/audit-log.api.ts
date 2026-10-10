import axios from '../../../core/client/api/http-client.js';

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

export interface AuditActor {
  _id: string;
  username: string;
  displayName?: string;
  roles: string[];
}

export interface AuditLogFilters {
  username: string;
  team: '' | 'admin' | 'welcome-team' | 'support-team';
}

export async function getAuditLog(
  filters?: AuditLogFilters,
): Promise<AdminAuditLogEntry[]> {
  const { data } = filters
    ? await axios.get('/api/admin/audit-log', { params: filters })
    : await axios.get('/api/admin/audit-log');
  return data as AdminAuditLogEntry[];
}

export async function getAuditLogActors(): Promise<AuditActor[]> {
  const { data } = await axios.get('/api/admin/audit-log/actors');
  return data;
}
