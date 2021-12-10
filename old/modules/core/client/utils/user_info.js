import { useTranslation } from 'react-i18next';

/**
 * Get label for profile gender options
 */
export function getGender(genderCode) {
  const { t } = useTranslation('users');

  switch (genderCode) {
    case 'female':
      return t('Female');
    case 'male':
      return t('Male');
    case 'non-binary':
      return t('Non-binary');
    case 'other':
      return t('Other gender');
    default:
      return undefined;
  }
}
