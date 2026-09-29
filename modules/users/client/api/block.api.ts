import axios from '../../../core/client/api/http-client.js';

// Block member
export async function block(username: string): Promise<unknown> {
  const { data } = await axios.put(`/api/blocked-users/${username}`);
  return data;
}

// Unblock member
export async function unblock(username: string): Promise<unknown> {
  const { data } = await axios.delete(`/api/blocked-users/${username}`);
  return data;
}

// List authenticated user's blocked members
export async function list(): Promise<unknown> {
  const { data } = await axios.get(`/api/blocked-users`);
  return data;
}
