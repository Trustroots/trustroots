import axios from 'axios';

/**
 * API request: update user
 * @param {object} reference - reference to save
 * @returns Promise<Reference> - saved reference
 */
export async function update(data) {
  await axios.put('/api/users', data);
}
