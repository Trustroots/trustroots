import axios from '../../../core/client/api/http-client.js';
import { nextPageParams } from './pagination';
import type {
  MarkMessagesReadRequest,
  MarkMessagesReadResponse,
  MessageMember,
  MessagePayload,
  MessageThreadSummary,
  PreviewMessageRequest,
  PreviewMessageResponse,
  HostingDetails,
  SendMessageRequest,
  UnreadMessageCountResponse,
} from '../../shared/messages';

export type MessageUser = MessageMember;
export type Message = MessagePayload;
export type { HostingDetails };
export type { MessageThreadSummary };

export interface HostingContext {
  description: string;
  acknowledgementRequired: boolean;
}

export type RequestParams = Record<
  string,
  string | string[] | number | boolean | undefined
>;
export type PageParams = Record<string, string | string[] | number | undefined>;

async function fetchWithNextParams<Data = unknown>(
  url: string,
  params: RequestParams,
): Promise<{ data: Data; nextParams?: PageParams }> {
  const { data, headers } = await axios.get<Data>(url, { params });
  const nextParams = nextPageParams(headers.link);
  return { data, nextParams };
}

export async function fetchThreads(
  params: RequestParams = {},
): Promise<{ threads: MessageThreadSummary[]; nextParams?: PageParams }> {
  const { data: threads, nextParams } = await fetchWithNextParams<
    MessageThreadSummary[]
  >('/api/messages', params);
  return { threads, nextParams };
}

export async function fetchMessages(
  userId: string,
  params: RequestParams = {},
): Promise<{ messages: Message[]; nextParams?: PageParams }> {
  const { data: messages, nextParams } = await fetchWithNextParams<Message[]>(
    `/api/messages/${userId}`,
    params,
  );
  return { messages, nextParams };
}

export async function fetchHostingContext(
  userToId: string,
): Promise<HostingContext> {
  const { data } = await axios.get<HostingContext>('/api/messages-hosting', {
    params: { userTo: userToId },
  });
  return data;
}

export async function sendMessage(
  userToId: string,
  content: string,
  hostingDescriptionAcknowledged?: boolean,
  hostingDetails?: HostingDetails,
): Promise<import('axios').AxiosResponse<Message>> {
  const payload: SendMessageRequest = {
    userTo: userToId,
    content,
    read: false,
    ...(hostingDescriptionAcknowledged === undefined
      ? {}
      : { hostingDescriptionAcknowledged }),
    ...(hostingDetails === undefined ? {} : { hostingDetails }),
  };
  return await axios.post<Message>('/api/messages', payload);
}

export async function markRead(messageIds: string[]): Promise<void> {
  const payload: MarkMessagesReadRequest = { messageIds };
  await axios.post<MarkMessagesReadResponse>('/api/messages-read', payload);
}

export async function unreadCount(): Promise<number> {
  const {
    data: { unread },
  } = await axios.get<UnreadMessageCountResponse>('/api/messages-count');
  return unread;
}

export async function previewMessage(content: string): Promise<string> {
  const payload: PreviewMessageRequest = { content };
  const { data } = await axios.post<PreviewMessageResponse>(
    '/api/messages-preview',
    payload,
  );
  return data.content;
}
