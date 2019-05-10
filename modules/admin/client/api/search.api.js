import axios from 'axios';

export async function searchUsers(query) {
  const { users } = await axios.get(`/api/admin/users?search=${query}`);
  return users;
}

export async function getUser(id) {
  const { user } = await axios.get(`/api/admin/user?id=${id}`);
  return user;
}
