import axios from 'axios';

export async function addNote({ note, userId }) {
  const { data } = await axios.post('/api/admin/notes', { note, userId });
  return data;
}

export async function listNotes(userId) {
  const { data } = await axios.get(`/api/admin/notes?userId=${userId}`);
  return data;
}
