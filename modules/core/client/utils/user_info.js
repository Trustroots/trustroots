import { useTranslation } from 'react-i18next';

/*
 * Functions passing strings to translation fuction for translation scripts
 */
export function getGender(genderCode) {
  const { t } = useTranslation(['users', 'languages']);

  switch (genderCode) {
    case 'female':
      return t('female');
    case 'male':
      return t('male');
    case 'non-binary':
      return t('non-binary');
    case 'other':
      return t('other gender');
    default:
      return undefined;
  }
}
