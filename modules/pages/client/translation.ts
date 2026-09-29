/** The application extracts page translations as strings from the locale files. */
export type PageTranslator = (
  key: string,
  options?: Record<string, unknown>,
) => string;
