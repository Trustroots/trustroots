import { useTranslation } from 'react-i18next';

export function getBirthdate(birthdate) {
  const { t } = useTranslation('users');

  return t('{{birthdate, age}} years.', { birthdate: new Date(birthdate) });
}

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
