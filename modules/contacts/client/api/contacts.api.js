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
