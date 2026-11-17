import axios from '../../../core/client/api/http-client.js';

export async function searchUsers(
  query: string,
  connectionsOnly = false,
): Promise<import('axios').AxiosResponse> {
  const filter = connectionsOnly ? '&connectionsOnly=true' : '';
  return await axios.get(
    `/api/users?search=${encodeURIComponent(query)}${filter}`,
    {
      timeout: 10000,
    },
  );
}
