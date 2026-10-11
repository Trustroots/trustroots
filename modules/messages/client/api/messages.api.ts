import axios from '../../../core/client/api/http-client.js';
import parseLinkheader from 'parse-link-header';
import type {
  MarkMessagesReadRequest,
  MarkMessagesReadResponse,
  MessageMember,
  MessagePayload,
  MessageThreadSummary,
  PreviewMessageRequest,
  PreviewMessageResponse,
  SendMessageRequest,
  UnreadMessageCountResponse,
} from '../../shared/messages';

export type MessageUser = MessageMember;
export type Message = MessagePayload;
export type { MessageThreadSummary };

export type RequestParams = Record<
  string,
  string | number | boolean | undefined
>;
export type PageParams = Record<string, string | number | undefined>;

async function fetchWithNextParams<Data = unknown>(
  url: string,
  params: RequestParams,
): Promise<{ data: Data; nextParams?: PageParams }> {
  const { data, headers } = await axios.get<Data>(url, { params });
  let nextParams: PageParams | undefined;
  if (headers.link) {
    const links = parseLinkheader(headers.link);
    if (links?.next) {
      const params: Partial<typeof links.next> = { ...links.next };
      delete params.url;
      delete params.rel;
      nextParams = params as PageParams;
    }
  }
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

export async function sendMessage(
  userToId: string,
  content: string,
): Promise<import('axios').AxiosResponse<Message>> {
  const payload: SendMessageRequest = {
    userTo: userToId,
    content,
    read: false,
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
