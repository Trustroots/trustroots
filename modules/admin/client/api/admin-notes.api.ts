import axios from '../../../core/client/api/http-client.js';

export async function addNote({
  note,
  userId,
}: {
  note: string;
  userId: string;
}) {
  const { data } = await axios.post('/api/admin/notes', { note, userId });
  return data;
}

export async function listNotes(userId: string) {
  const { data } = await axios.get(`/api/admin/notes?userId=${userId}`);
  return data;
}
