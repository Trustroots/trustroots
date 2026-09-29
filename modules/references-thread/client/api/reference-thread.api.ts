import axios from '../../../core/client/api/http-client.js';

export interface ReferenceThreadData {
  reference: 'yes' | 'no';
  created: string | Date;
}

export interface ReferenceAnswer {
  answer: boolean;
  message?: string;
}

export async function get(userTo: string): Promise<ReferenceThreadData | null> {
  const { data } = await axios.get(`/api/references-thread/${userTo}`);
  return data;
}

export async function send(
  answer: 'yes' | 'no',
  userTo: string,
): Promise<unknown> {
  const { data } = await axios.post(`/api/references-thread`, {
    reference: answer,
    userTo,
  });
  return data;
}
