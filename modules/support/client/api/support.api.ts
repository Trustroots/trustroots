import axios from 'axios';

export type SupportRequest = {
  category?: string;
  email?: string;
  message: string;
  reportMember?: string;
  username?: string;
};

export async function send(request: SupportRequest): Promise<unknown> {
  return await axios.post('/api/support', request);
}

export async function reportMember(
  user: { username: string },
  message: string,
): Promise<void> {
  await send({ message, reportMember: user.username });
}
