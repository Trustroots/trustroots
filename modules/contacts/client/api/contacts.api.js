import axios from 'axios';

export async function remove(contactId) {
  await axios.delete(`/api/contact/${contactId}`);
}

export async function getContactsCommon(id) {
  const { data } = await axios.get(`/api/contacts/${id}/common`);
  return data;
}

export async function getByUserId(userId) {
  try {
    const { data } = await axios.get(`/api/contact-by/${userId}`);
    return data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
}

export async function getByContactId(contactId) {
  const { data } = await axios.get(`/api/contact/${contactId}`);
  return data;
}

export async function list(listUserId) {
  const { data } = await axios.get(`/api/contacts/${listUserId}`);
  return data;
}

export async function create({ friendUserId, message }) {
  const { data } = await axios.post('/api/contact', { friendUserId, message });
  return data;
}

export async function confirm(contactId) {
  const { data } = await axios.put(`/api/contact/${contactId}`, {
    confirm: true,
  });
  return data;
}
