import axios from 'axios';

export async function getMessages(user1: string, user2: string) {
  const { data } = await axios.post('/api/admin/messages', { user1, user2 });
  return data;
}

export async function getScammerRecipients(username: string) {
  const { data } = await axios.post('/api/admin/messages/scammer-recipients', {
    username,
  });
  return data;
}

export async function sendScammerWarning(
  username: string,
  content: string,
  requestId: string,
) {
  const { data } = await axios.post('/api/admin/messages/scammer-warning', {
    username,
    content,
    requestId,
  });
  return data;
}
