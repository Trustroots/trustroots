import axios from 'axios';

// Block member
export async function block(username) {
  const { data } = await axios.put(`/api/blocked-users/${username}`);
  return data;
}

// Unblock member
export async function unblock(username) {
  const { data } = await axios.delete(`/api/blocked-users/${username}`);
  return data;
}

// List authenticated user's blocked members
export async function list() {
  const { data } = await axios.get(`/api/blocked-users`);
  return data;
}
