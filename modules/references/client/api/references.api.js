import axios from 'axios';

/**
 * API request: create a reference
 * @param {object} reference - reference to save
 * @returns Promise<Reference> - saved reference
 */
export async function create(reference) {
  const { data: responseReference } = await axios.post(
    '/api/references',
    reference,
  );
  return responseReference;
}

/**
 * API request: read references, filter them by userTo,
 * and sort by 'created' field starting from the most recent date
 *
 * @param {string} userTo - id of user who received the reference
 * @returns {array} - array of the found references
 */
export async function read({ userTo }) {
  const { data: references } = await axios.get('/api/references', {
    params: { userTo },
  });
  return references;
}

/**
 * API request: read references written by loggedIn user, filter them by userTo,
 * and sort by 'created' field starting from the most recent date
 *
 * @param {string} userTo - id of user who received the reference
 * @returns {object} - A reference
 */
export async function readMine({ userTo }) {
  const params = { userTo };
  try {
    const { data: reference } = await axios.get('/api/my-reference', {
      params,
    });
    return reference;
  } catch (err) {
    if (err.response?.status === 404) {
      return null;
    } else {
      throw err;
    }
  }
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

/**
 * API request: get count of references
 *
 * @param {string} userTo - id of user who received the reference
 * @returns {object} - Number of experiences as `{count: Int, hasPending: Bool}`
 */
export async function getCount(userTo) {
  try {
    const { data } = await axios.get('/api/references/count', {
      params: { userTo },
    });
    return data;
  } catch {
    return { count: 0 };
  }
}
