import { createHash } from 'node:crypto';
import i18next from 'i18next';
import type { Catalogue, Entry, Language } from '../shared.ts';

export type Strings = Record<string, string>;
export interface Review {
  sourceHash: string;
  value: string;
  reviewer: string;
  previous: string | null;
  reviewedAt: string;
}
export interface Snapshot {
  revision: string;
  languages: Language[];
  source: Record<string, Strings>;
  target: Record<string, Strings>;
  reviews: Record<string, Review>;
}

export const digest = (text: string) =>
  createHash('sha256').update(text).digest('hex');

const plurals = i18next.createInstance();
void plurals.init({ fallbackLng: 'en', initImmediate: false });
interface Plurals {
  getSuffixes(locale: string): string[];
  getSuffix(locale: string, count: number): string;
  getRule(locale: string): { numbers: number[] } | undefined;
}
const resolver = plurals.services.pluralResolver as Plurals;

export function catalogue(locale: string, snapshot: Snapshot): Catalogue {
  if (
    locale === 'en' ||
    !snapshot.languages.some(lang => lang.code === locale)
  ) {
    throw new Error('Unsupported target language.');
  }
  const entries: Entry[] = [];
  const language = locale.replaceAll('_', '-');
  for (const [namespace, strings] of Object.entries(snapshot.source)) {
    for (const [key, source] of Object.entries(strings)) {
      if (key.endsWith('_plural') && Object.hasOwn(strings, key.slice(0, -7))) {
        continue;
      }
      const plural = Object.hasOwn(strings, key + '_plural');
      const suffixes = plural ? resolver.getSuffixes(language) : [''];
      for (const suffix of suffixes) {
        const targetKey = key + suffix;
        const count = resolver
          .getRule(language)
          ?.numbers.find(
            number => resolver.getSuffix(language, number) === suffix,
          );
        const english =
          plural && count !== 1 ? strings[key + '_plural'] : source;
        const id = namespace + ':' + targetKey;
        const original = snapshot.target[namespace]?.[targetKey] ?? null;
        const sourceHash = digest(
          JSON.stringify([key, source, strings[key + '_plural']]),
        );
        const review = snapshot.reviews[id];
        entries.push({
          id,
          namespace,
          key: targetKey,
          source: english,
          sourceHash,
          original,
          needsReview:
            !original || Boolean(review && review.sourceHash !== sourceHash),
          reviewed: Boolean(
            review &&
            review.sourceHash === sourceHash &&
            review.value === original,
          ),
        });
      }
    }
  }
  return { locale, revision: snapshot.revision, entries };
}
