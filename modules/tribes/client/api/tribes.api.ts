import axios from 'axios';
import type { UserProfile } from '@/modules/users/client/types';

export interface TribeSummary {
  _id: string;
  slug: string;
  label: string;
  count: number;
  color?: string;
  image?: string;
  new?: boolean;
  description?: string;
  attribution?: string;
  attribution_url?: string;
  [key: string]: unknown;
}

export interface TribeListOptions {
  limit?: number;
  sortBy?: 'count' | 'alphabetically';
}

export interface MembershipUpdate {
  tribe?: TribeSummary;
  user?: UserProfile;
}

export async function listMemberships(): Promise<MembershipUpdate[]> {
  const { data } = await axios.get('/api/users/memberships');
  return data;
}

export async function join(tribeId: string): Promise<MembershipUpdate> {
  const { data } = await axios.post(`/api/users/memberships/${tribeId}`);
  return data;
}

export async function leave(tribeId: string): Promise<MembershipUpdate> {
  const { data } = await axios.delete(`/api/users/memberships/${tribeId}`);
  return data;
}

/**
 * @param {Number} limit
 * @param {String} sortBy Values count|alphabetically. Sort either by count or by alphabetical label order; defaults to count.
 */
export async function read({ limit = 150 }: TribeListOptions = {}): Promise<
  TribeSummary[]
> {
  const { data } = await axios.get('/api/tribes', { params: { limit } });
  return data;
}

export async function get(slug: string): Promise<TribeSummary> {
  const { data } = await axios.get(`/api/tribes/${slug}`);
  return data;
}
