import axios from 'axios';

export async function send(request) {
  return await axios.post('/api/support', request);
}

/**
 * Report a member using their username.
 * @param {{ username: string }} user Member being reported.
 * @param {string} message Report text.
 * @returns {Promise<void>}
 */
export async function reportMember(user, message) {
  await send({ message, reportMember: user.username });
}
