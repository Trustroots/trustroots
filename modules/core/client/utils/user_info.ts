import { useTranslation } from 'react-i18next';

export type GenderCode = 'female' | 'male' | 'non-binary' | 'other' | string;

/** Get label for profile gender options. */
export function getGender(genderCode: GenderCode): string | undefined {
  const { t } = useTranslation('users');

  switch (genderCode) {
    case 'female':
      return t('Female') as string;
    case 'male':
      return t('Male') as string;
    case 'non-binary':
      return t('Non-binary') as string;
    case 'other':
      return t('Other gender') as string;
    default:
      return undefined;
  }
}
