import axios from 'axios';

export async function getOffers(query = {}) {
  const { data } = await axios.get(`/api/offers?${new URLSearchParams(query)}`);
  return data;
}
