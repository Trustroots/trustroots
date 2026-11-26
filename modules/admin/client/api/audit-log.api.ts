import axios from '@trustroots/core/http-client';

export interface AdminAuditLogEntry {
  _id: string;
  route?: string;
  user?: Record<string, unknown>;
  ipHash?: string;
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
  action?: '' | 'shadowban' | 'suspend';
  hideOwn?: boolean;
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
