import { useQuery } from 'react-query';
import axios from '../../../core/client/api/http-client.js';

export type LanguageOption = {
  value: string;
  label: string;
  deprecated?: boolean;
};

type LanguageFormat = 'array' | 'object';
type LanguagesOptions<Format extends LanguageFormat> = { format: Format };
type LanguageResult<Format extends LanguageFormat> = Format extends 'array'
  ? LanguageOption[]
  : Record<string, string>;

/** Fetch languages in the selected API representation. */
const getLanguages = async <Format extends LanguageFormat>({
  format,
}: LanguagesOptions<Format>): Promise<LanguageResult<Format>> => {
  const { data } = await axios.get<LanguageResult<Format>>(
    `/api/languages?format=${format}`,
  );
  return data;
};

/** Return the React Query hook for the selected API representation. */
export function useLanguagesQuery<Format extends LanguageFormat = 'object'>(
  options: Partial<LanguagesOptions<Format>> = {},
) {
  const format = options.format || ('object' as Format);
  return useQuery(['languages', format], () => getLanguages({ format }), {
    refetchOnWindowFocus: false,
  });
}
