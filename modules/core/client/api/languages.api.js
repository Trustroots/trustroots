import { useQuery } from 'react-query';
import axios from 'axios';

const getLanguages = async ({ format = 'object' }) => {
  const { data } = await axios.get(`/api/languages?format=${format}`);
  return data;
};

export function useLanguagesQuery({ format = 'object' }) {
  return useQuery(
    ['languages', format],
    () => getLanguages({ format }),
    { refetchOnWindowFocus: false }, // , cacheTime: Infinity
  );
}
