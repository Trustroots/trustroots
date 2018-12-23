import axios from 'axios';

/**
 * Delete a contact.
 */
export async function remove(contactId) {
  await axios.delete(`/api/contact/${contactId}`);
}
