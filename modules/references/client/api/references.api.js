import axios from 'axios';

/**
 * API request: create a reference
 * @param {object} reference - reference to save
 * @returns Promise<Reference> - saved reference
 */
export async function create(reference) {
  return await axios.post('/api/references', reference);
}

/**
 * API request: read references and filter by userFrom and userTo
 * @param {string} userFrom - id of user who gave the reference
 * @param {string} userTo - id of user who received the reference
 * @returns Promise<Reference[]> - array of the found references
 */
export async function read({ userFrom, userTo }) {
  return await axios.get(`/api/references?userFrom=${userFrom}&userTo=${userTo}`);
}

/**
 * API request: report a member
 * @TODO this request belongs to a different module
 * @param {object} user - member to report
 * @param {string} message - message to administrators
 * @returns Promise<void>
 */
export async function report(user, message) {
  await axios.post('/api/support', { message, reportMember: user.username });
}
