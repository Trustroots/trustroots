// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import { useLanguagesQuery } from '@/modules/core/client/api/languages.api';

export default function LanguageList({ languages = [], className }) {
  const { t } = useTranslation(['languages']);
  const { data: languageNames, isLoading } = useLanguagesQuery();

  if (isLoading || !languages.length) {
    return null;
  }

  return (
    <ul className={className}>
      {languages.map(code => (
        <li key={code}>
          {languageNames[code]
            ? // i18next-extract-disable-next-line
              t(languageNames[code], { ns: 'languages' })
            : code}
        </li>
      ))}
    </ul>
  );
}

LanguageList.propTypes = {
  className: PropTypes.string,
  languages: PropTypes.array.isRequired,
};
