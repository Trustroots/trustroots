import { useTranslation } from 'react-i18next';
import { match } from 'ts-pattern';

export type GenderCode = 'female' | 'male' | 'non-binary' | 'other' | string;

/** Get label for profile gender options. */
export function getGender(genderCode: GenderCode): string | undefined {
  const { t } = useTranslation('users');

  return match(genderCode)
    .with('female', () => t('Female') as string)
    .with('male', () => t('Male') as string)
    .with('non-binary', () => t('Non-binary') as string)
    .with('other', () => t('Other gender') as string)
    .otherwise(() => undefined);
}
