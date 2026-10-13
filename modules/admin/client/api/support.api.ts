import http from '../../../core/client/api/http-client';

export interface SupportRequest {
  _id: string;
  category: string;
  sent: string;
  username?: string;
  email: string;
  message: string;
  reportMember?: string;
  user?: string;
  reportedUser?: string;
  status?: 'open' | 'resolved';
}
export interface Page<T> {
  items: T[];
  page: number;
  hasMore: boolean;
}
export interface SupportMember {
  _id: string;
  username: string;
  displayName: string;
  email: string;
  emailTemporary?: string;
  public: boolean;
  roles: string[];
  description?: string;
  tagline?: string;
  locationLiving?: string;
  locationFrom?: string;
  languages?: string[];
  pendingDeletion: boolean;
}
export interface InvestigationItem {
  _id: string;
  created: string;
  userFrom: { username: string; displayName: string } | null;
  userTo: { username: string; displayName: string } | null;
  content?: string;
  feedbackPublic?: string;
  recommend?: string;
  public?: boolean;
  shadowHidden?: boolean;
}
export async function load<T>(path: string): Promise<T> {
  const { data } = await http.get<T>(path);
  return data;
}
export async function setStatus(id: string, status: 'open' | 'resolved') {
  await http.patch(`/api/admin/support/${encodeURIComponent(id)}`, { status });
}
