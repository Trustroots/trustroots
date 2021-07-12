import axios from 'axios';

export async function getLanguages({ format = 'object' }) {
  const { data } = await axios.get(`/api/languages?format=${format}`);
  return data;
}
