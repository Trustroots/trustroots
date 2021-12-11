//import axios from 'axios';
import userData from './user.json'

/**
 * API request: update user
 * @param {object} reference - reference to save
 * @returns Promise<Reference> - saved reference
 */
export async function updateUser(data) {
  //await axios.put('/api/users', data);
}

/**
 * API request: fetch user
 *
 * @param {string} username
 * @returns {Promise<User>} - the user
 */
export async function getUser(username) {
  return userData;
}
