import axios from '../../../core/client/api/http-client.js';

export interface AdminThread {
  _id: string;
  userFromProfile: Array<{
    _id: string;
    username?: string;
    displayName?: string;
    [key: string]: unknown;
  }>;
  userToProfile: Array<{
    _id: string;
    username?: string;
    displayName?: string;
    [key: string]: unknown;
  }>;
  read: boolean;
  updated: string;
  firstMessage?: string | null;
  lastMessage?: string | null;
  votes?: Array<{
    _id: string;
    userFrom: string;
    userTo: string;
    reference: 'yes' | 'no';
  }>;
  [key: string]: unknown;
}

export async function getThreads({
  userId = '',
  username = '',
}: {
  userId?: string;
  username?: string;
}): Promise<AdminThread[]> {
  const { data } = await axios.post('/api/admin/threads', { userId, username });
  return data as AdminThread[];
}
