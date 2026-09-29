import axios from '../../../core/client/api/http-client.js';

/**
 * @returns Promise<void>
 */
export async function get() {
  return await axios.get('/api/statistics');
}
