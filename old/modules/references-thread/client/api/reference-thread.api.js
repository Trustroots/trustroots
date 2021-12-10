import axios from 'axios';

export async function get(userTo) {
  const { data } = await axios.get(`/api/references-thread/${userTo}`);
  return data;
}

export async function send(answer, userTo) {
  const { data } = await axios.post(`/api/references-thread`, {
    reference: answer,
    userTo,
  });
  return data;
}
