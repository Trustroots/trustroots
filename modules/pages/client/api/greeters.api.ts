import axios from '@trustroots/core/http-client';

export interface Greeter {
  _id: string;
  username: string;
  displayName: string;
}

export async function getGreeters(): Promise<{ greeters: Greeter[] }> {
  const { data } = await axios.get<{ greeters: Greeter[] }>('/api/greeters');
  return data;
}
