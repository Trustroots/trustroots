import type { GravatarPhotoCheck } from '../../shared/gravatar-photo-check.mts';
import axios from '@trustroots/core/http-client';
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

export async function getGravatarPhotoCheck(): Promise<GravatarPhotoCheck | null> {
  const { data } = await axios.get<GravatarPhotoCheck | null>(
    '/api/admin/gravatar/photo-check',
  );
  return data;
}

export async function startGravatarPhotoCheck(
  cleanup = false,
): Promise<GravatarPhotoCheck> {
  const url = '/api/admin/gravatar/photo-check';
  const { data } = await axios.post<GravatarPhotoCheck>(
    cleanup ? `${url}?cleanup=1` : url,
  );
  return data;
}
