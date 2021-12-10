import axios from 'axios';

/**
 * @returns Promise<void>
 */
export async function get() {
  return await axios.get('/api/statistics');
}
