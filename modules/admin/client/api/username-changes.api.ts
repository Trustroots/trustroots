import axios from '../../../core/client/api/http-client.js';

export type AdminUsernameChangeRange = '90d' | 'all';

export interface AdminUsernameChange {
  _id: string;
  currentUsername: string;
  displayName?: string;
  oldUsername: string | null;
  newUsername: string;
  changedAt: string;
  legacy: boolean;
}

export interface AdminUsernameChangesPage {
  changes: AdminUsernameChange[];
  page: number;
  hasNextPage: boolean;
  range: AdminUsernameChangeRange;
}

export async function getUsernameChanges(
  page: number,
  range: AdminUsernameChangeRange = '90d',
): Promise<AdminUsernameChangesPage> {
  const { data } = await axios.get('/api/admin/username-changes', {
    params: { page, range },
  });
  return data as AdminUsernameChangesPage;
}
