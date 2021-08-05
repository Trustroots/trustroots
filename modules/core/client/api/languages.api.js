import { useQuery } from 'react-query';
import axios from 'axios';

/**
 * Get languages from API
 * @param options  {Object} Options
 * @param options.format  {String} format API should return; either string value "array" or "object"
 * @return {Promise} Results from API
 */
const getLanguages = async ({ format }) => {
  const { data } = await axios.get(`/api/languages?format=${format}`);
  return data;
};

/**
 * Get languages from API
 *
 * @param options  {Object} Options
 * @param options.format  {String} format API should return; either string value "array" or "object"
 * @return {Object} React Query hook https://react-query.tanstack.com/reference/useQuery
 */
export function useLanguagesQuery(options = {}) {
  const { format = 'object' } = options;
  return useQuery(
    ['languages', format],
    () => getLanguages({ format }),
    { refetchOnWindowFocus: false }, // , cacheTime: Infinity
  );
}
