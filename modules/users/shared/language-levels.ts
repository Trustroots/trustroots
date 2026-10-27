export const languageLevelLabels = {
  basic: 'Basic',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  native: 'Native',
} as const;

export type LanguageLevel = keyof typeof languageLevelLabels;
export type LanguageLevels = Partial<Record<string, LanguageLevel>>;

export function validLanguageLevels(
  levels: unknown,
  languages: readonly string[],
): levels is LanguageLevels {
  return (
    levels !== null &&
    typeof levels === 'object' &&
    !Array.isArray(levels) &&
    Object.entries(levels).every(
      ([code, level]) =>
        languages.includes(code) &&
        typeof level === 'string' &&
        Object.prototype.hasOwnProperty.call(languageLevelLabels, level),
    )
  );
}
