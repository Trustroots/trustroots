import axios from 'axios';

export async function getMessages(user1, user2) {
  const { data } = await axios.post('/api/admin/messages', { user1, user2 });
  return data;
}
