import axios from '../../../core/client/api/http-client.js';

export async function searchUsers(
  query: string,
): Promise<import('axios').AxiosResponse> {
  return await axios.get(`/api/users?search=${encodeURIComponent(query)}`, {
    timeout: 10000,
  });
}
