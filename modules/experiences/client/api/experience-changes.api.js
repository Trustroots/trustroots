import axios from 'axios';

const base = id => `/api/experiences/${id}`;

export async function readAccess(id, secret) {
  const { data } = await axios.get(`${base(id)}/change-access`, {
    headers: { 'X-Experience-Change-Secret': secret },
  });
  return data;
}

export async function readMine(id) {
  const { data } = await axios.get(`${base(id)}/change-requests/mine`);
  return data;
}

export async function submit(id, secret, request) {
  const { data } = await axios.post(`${base(id)}/change-requests`, request, {
    headers: { 'X-Experience-Change-Secret': secret },
  });
  return data;
}
