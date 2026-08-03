import axios from 'axios';

export async function getMessages(user1, user2) {
  const { data } = await axios.post('/api/admin/messages', { user1, user2 });
  return data;
}

export async function getScammerRecipients(username) {
  const { data } = await axios.post('/api/admin/messages/scammer-recipients', {
    username,
  });
  return data;
}

export async function sendScammerWarning(username, content) {
  const { data } = await axios.post('/api/admin/messages/scammer-warning', {
    username,
    content,
  });
  return data;
}
