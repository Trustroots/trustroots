import axios from '../../../core/client/api/http-client.js';
import type { GravatarSort } from '../../shared/gravatar.mts';

export interface GravatarUsage {
  accounts: number;
  members: {
    _id: string;
    username: string;
    displayName?: string;
    seen?: string;
  }[];
  page: number;
  hasNextPage: boolean;
  measuredAt: string;
}

export async function getGravatarUsage(
  page: number,
  sort?: GravatarSort,
): Promise<GravatarUsage> {
  const { data } = await axios.get('/api/admin/gravatar', {
    params: sort
      ? { page, sort: sort.column, direction: sort.direction }
      : { page },
  });
  return data as GravatarUsage;
}
