import axios from 'axios';

export async function send(request) {
  return await axios.post('/api/support', request);
}

export async function reportMember(user, message) {
  await send({ message, reportMember: user.username });
}
