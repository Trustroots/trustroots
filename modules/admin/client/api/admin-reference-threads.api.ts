import axios from '../../../core/client/api/http-client.js';

export type ReferenceUserOrId = string | { _id: string };

export interface ReferenceThread {
  _id: string;
  created: string | number;
  reference?: string;
  userFrom?: ReferenceUserOrId;
  userTo?: ReferenceUserOrId;
}

export interface TopNegativeRecipient {
  count: number;
  user: ReferenceUserOrId;
}

export interface ReferenceThreadsResponse {
  items: ReferenceThread[];
  topNegativeRecipients?: TopNegativeRecipient[];
}

export async function getReferenceThreads(): Promise<
  ReferenceThread[] | ReferenceThreadsResponse
> {
  const { data } = await axios.get('/api/admin/reference-threads');
  return data as ReferenceThread[] | ReferenceThreadsResponse;
}
