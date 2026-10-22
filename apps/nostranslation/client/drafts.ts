import type { Entry } from '../shared.ts';

export interface Draft {
  value: string;
  approved: boolean;
  sourceHash: string;
  original: string | null;
}
export type Drafts = Record<string, Draft>;
const key = (locale: string) => 'nostranslation:' + locale;

export function loadDrafts(locale: string): Drafts {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(key(locale)) ?? '{}',
    );
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, value]) =>
          value &&
          typeof value.value === 'string' &&
          typeof value.approved === 'boolean' &&
          typeof value.sourceHash === 'string' &&
          (value.original === null || typeof value.original === 'string'),
      ),
    );
  } catch {
    return {};
  }
}

export function saveDrafts(locale: string, drafts: Drafts) {
  try {
    localStorage.setItem(key(locale), JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}

export function rebaseDrafts(drafts: Drafts, entries: Entry[]): Drafts {
  return Object.fromEntries(
    entries
      .filter(entry => drafts[entry.id])
      .map(entry => {
        const previous = drafts[entry.id];
        return [
          entry.id,
          {
            ...previous,
            sourceHash: entry.sourceHash,
            original: entry.original,
            approved:
              previous.approved &&
              previous.sourceHash === entry.sourceHash &&
              previous.original === entry.original,
          },
        ];
      }),
  );
}
