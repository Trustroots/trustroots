import http from '../../../core/client/api/http-client';
import type { SupportStatus } from '../../../support/shared/statuses';

export interface SupportRequest {
  _id: string;
  category: string;
  sent: string;
  username?: string;
  email: string;
  message: string;
  subject?: string;
  lastActivityAt?: string;
  reportMember?: string;
  user?: string;
  reportedUser?: string;
  status?: SupportStatus | 'resolved';
  statusProvenance?: 'explicit' | 'missing';
}
export interface Page<T> {
  items: T[];
  page: number;
  hasMore: boolean;
}
export interface SupportQueueResponse extends Page<SupportRequest> {
  total: number;
  matchingTotal: number;
  statusCounts: Record<SupportStatus, number>;
  unconfirmedCount?: number;
}
export interface SupportAttachment {
  filename?: string;
  contentType?: string;
  size?: number;
}
export interface SupportConversationItem {
  _id: string;
  request: string;
  direction: 'inbound' | 'outbound';
  kind: 'initial' | 'reply' | 'acknowledgement';
  body: string;
  createdAt: string;
  authorId?: string;
  authorName?: string;
  deliveryState:
    | 'received'
    | 'queued'
    | 'sending'
    | 'accepted'
    | 'captured'
    | 'failed'
    | 'uncertain';
  attachments?: SupportAttachment[];
  oversized?: boolean;
  truncated?: boolean;
}
export interface SupportListFilters {
  status: string;
  category?: string;
  page: number;
  q?: string;
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
export async function listRequests(filters: SupportListFilters) {
  const query = new URLSearchParams({
    status: filters.status,
    page: String(filters.page),
  });
  if (filters.category) query.set('category', filters.category);
  if (filters.q) query.set('q', filters.q);
  return load<SupportQueueResponse>(`/api/admin/support?${query.toString()}`);
}

export async function setStatus(id: string, status: SupportStatus) {
  await http.patch(`/api/admin/support/${encodeURIComponent(id)}`, { status });
}

export async function loadConversation(id: string, page: number) {
  return load<Page<SupportConversationItem>>(
    `/api/admin/support/${encodeURIComponent(id)}/conversation?page=${page}`,
  );
}

export async function sendReply(
  id: string,
  body: string,
  idempotencyKey: string,
) {
  const { data } = await http.post<SupportConversationItem>(
    `/api/admin/support/${encodeURIComponent(id)}/replies`,
    { body, idempotencyKey },
  );
  return data;
}

export async function retryReply(
  id: string,
  messageId: string,
  idempotencyKey: string,
  confirmUncertain = false,
) {
  const { data } = await http.post<SupportConversationItem>(
    `/api/admin/support/${encodeURIComponent(id)}/replies/${encodeURIComponent(messageId)}/retry`,
    { idempotencyKey, ...(confirmUncertain ? { confirmUncertain: true } : {}) },
  );
  return data;
}
