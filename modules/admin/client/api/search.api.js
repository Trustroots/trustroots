import axios from 'axios';

export async function searchUsers(query) {
  const { data } = await axios.get(`/api/admin/users?search=${query}`);
  return data;
}

export async function getUser(id) {
  const { data } = await axios.get(`/api/admin/user?id=${id}`);
  return data;
}
