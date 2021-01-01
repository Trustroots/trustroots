import axios from 'axios';

/**
 * API request: create an experience
 * @param {object} experience - experience to save
 * @returns {object} - saved experience object, which includes the "response" to it if exists
 */
export async function create(experience) {
  const { data: responseExperience } = await axios.post(
    '/api/experiences',
    experience,
  );
  return responseExperience;
}

/**
 * API request: read experiences shared with `userTo`;
 * sorted by `created` field starting from the most recent date
 *
 * @param {string} userTo - id of the user with whom the experiences were shared
 * @returns {array} - array of experience objects, which include the "responses" to them where exist
 */
export async function read({ userTo }) {
  const { data: experiences } = await axios.get('/api/experiences', {
    params: { userTo },
  });
  return experiences;
}

/**
 * API request: read the experience shared by the logged-in user with `userTo`
 *
 * @param {string} userTo - id of the user with whom the experience was shared
 * @returns {object} - experience object, which includes the "response" to it if exists
 */
export async function readMine({ userTo }) {
  const params = { userTo };
  try {
    const { data: experience } = await axios.get('/api/my-experience', {
      params,
    });
    return experience;
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
 * API request: get count of experiences
 *
 * @param {string} userTo - id of the user with whom the experiences were shared
 * @returns {object} - Number of experiences as `{count: Int, hasPending: Bool}`
 */
export async function getCount(userTo) {
  try {
    const { data } = await axios.get('/api/experiences/count', {
      params: { userTo },
    });
    return data;
  } catch {
    return { count: 0 };
  }
}
