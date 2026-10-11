import axios from '../../../core/client/api/http-client.js';
import parseLinkheader from 'parse-link-header';
export type MessageUser = {
  _id: string;
  username?: string | null;
  displayName?: string | null;
  photo?: string;
  member?: unknown[];
  languages?: unknown[];
};

export type Message = {
  _id: string;
  content: string;
  created: string;
  read: boolean;
  userFrom: MessageUser;
  userTo: MessageUser;
};

export type MessageThreadSummary = {
  _id: string;
  read: boolean;
  updated: string;
  userFrom: MessageUser;
  userTo: MessageUser;
  message: { excerpt: string };
};

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
  return await axios.post<Message>('/api/messages', {
    userTo: userToId,
    content,
    read: false,
  });
}

export async function markRead(messageIds: string[]): Promise<void> {
  await axios.post('/api/messages-read', { messageIds });
}

export async function unreadCount(): Promise<number> {
  const {
    data: { unread },
  } = await axios.get<{ unread: number }>('/api/messages-count');
  return unread;
}

export async function previewMessage(content: string): Promise<string> {
  const { data } = await axios.post<{ content: string }>(
    '/api/messages-preview',
    {
      content,
    },
  );
  return data.content;
}
