export interface Language {
  code: string;
  label: string;
  english: string;
}

export interface Entry {
  id: string;
  namespace: string;
  key: string;
  source: string;
  sourceHash: string;
  original: string | null;
  needsReview: boolean;
  reviewed?: boolean;
  suggestion?: string;
  model?: string;
}

export interface Catalogue {
  locale: string;
  revision: string;
  entries: Entry[];
}

export interface Change {
  id: string;
  sourceHash: string;
  original: string | null;
  value: string;
}

export interface Submission {
  username: string;
  locale: string;
  changes: Change[];
}

/** Validate text without ever interpreting contributed markup as HTML. */
export function validateTranslation(
  source: string,
  value: string,
): string | null {
  if (!value.trim() || value.length > 10000) {
    return 'Enter a translation of at most 10,000 characters.';
  }
  const placeholders = (text: string) =>
    [...text.matchAll(/\{\{[^{}]+\}\}/g)].map(match => match[0]).sort();
  if (
    /\{\{\{|\}\}\}/.test(value) ||
    JSON.stringify(placeholders(source)) !==
      JSON.stringify(placeholders(value)) ||
    /\{\{|\}\}/.test(value.replace(/\{\{[^{}]+\}\}/g, ''))
  ) {
    return 'Keep every {{placeholder}} exactly as in the English text.';
  }
  const tags = (text: string) => text.match(/<\/?[A-Za-z0-9][^>]*>/g) ?? [];
  if (
    JSON.stringify(tags(source).sort()) !== JSON.stringify(tags(value).sort())
  ) {
    return 'Keep the formatting tags from the English text.';
  }
  const stack: string[] = [];
  for (const tag of value.match(/<\/?\d+>/g) ?? []) {
    const name = tag.replace(/\D/g, '');
    if (tag.startsWith('</')) {
      if (stack.pop() !== name) return 'Keep formatting tags correctly nested.';
    } else stack.push(name);
  }
  return stack.length ? 'Close every formatting tag.' : null;
}
