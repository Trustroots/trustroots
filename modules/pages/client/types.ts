export interface PageUser {
  _id?: string;
  displayName?: string;
  username: string;
}

export type PageTranslator = (
  key: string,
  options?: Record<string, unknown>,
) => string;
