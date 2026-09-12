import axios from 'axios';

/**
 * Delete a contact.
 */
export async function remove(contactId) {
  await axios.delete(`/api/contact/${contactId}`);
}

export async function getContactsCommon(id) {
  const { data } = await axios.get(`/api/contacts/${id}/common`);
  return data;
}

export async function getByContactId(contactId) {
  const { data } = await axios.get(`/api/contact/${contactId}`);
  return data;
}

export async function confirm(contactId) {
  const { data } = await axios.put(`/api/contact/${contactId}`, {
    confirm: true,
  });
  return data;
}
