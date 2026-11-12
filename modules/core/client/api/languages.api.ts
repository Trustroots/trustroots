import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import axios from '../../../core/client/api/http-client.js';

const languageOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  deprecated: z.boolean().optional(),
});

const languageResponseSchemas = {
  array: z.array(languageOptionSchema),
  object: z.record(z.string(), z.string()),
};

export type LanguageOption = z.infer<typeof languageOptionSchema>;
type LanguageFormat = keyof typeof languageResponseSchemas;
type LanguagesOptions<Format extends LanguageFormat> = { format: Format };
type LanguageResult<Format extends LanguageFormat> = z.infer<
  (typeof languageResponseSchemas)[Format]
>;

/** Fetch languages in the selected API representation. */
const getLanguages = async <Format extends LanguageFormat>({
  format,
}: LanguagesOptions<Format>): Promise<LanguageResult<Format>> => {
  const { data } = await axios.get<unknown>(`/api/languages?format=${format}`);
  const result = languageResponseSchemas[format].safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid language response for format "${format}"`);
  }
  return result.data as LanguageResult<Format>;
};

/** Return the React Query hook for the selected API representation. */
export function useLanguagesQuery<Format extends LanguageFormat = 'object'>(
  options: Partial<LanguagesOptions<Format>> = {},
) {
  const format = options.format || ('object' as Format);
  return useQuery({
    queryKey: ['languages', format],
    queryFn: () => getLanguages({ format }),
    refetchOnWindowFocus: false,
  });
}
