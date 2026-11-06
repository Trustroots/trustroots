import axios from '../../../core/client/api/http-client.js';

export interface GravatarUsage {
  accounts: number;
  members: { _id: string; username: string; displayName?: string }[];
  page: number;
  hasNextPage: boolean;
  measuredAt: string;
}

export async function getGravatarUsage(page: number): Promise<GravatarUsage> {
  const { data } = await axios.get('/api/admin/gravatar', { params: { page } });
  return data as GravatarUsage;
}
