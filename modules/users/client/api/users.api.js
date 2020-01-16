import axios from 'axios';

/**
 * API request: update user
 * @param {object} reference - reference to save
 * @returns Promise<Reference> - saved reference
 */
export async function update(data) {
  await axios.put('/api/users', data);
}

/**
 * API request: fetch user
 *
 * @param {string} username
 * @returns {Promise<User>} - the user
 */
export async function fetch(username) {
  const { data: user } = await axios.get(`/api/users/${username}`);
  return user;
}
