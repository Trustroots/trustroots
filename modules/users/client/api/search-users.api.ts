import axios from 'axios';

export async function searchUsers(
  query: string,
): Promise<import('axios').AxiosResponse> {
  return await axios.get(`/api/users?search=${query}`);
}
