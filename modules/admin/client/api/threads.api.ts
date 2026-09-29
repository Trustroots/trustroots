import axios from 'axios';

export interface AdminThread {
  _id: string;
  userFromProfile: Array<{ _id: string; [key: string]: unknown }>;
  userToProfile: Array<{ _id: string; [key: string]: unknown }>;
  read: boolean;
  updated: string;
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
