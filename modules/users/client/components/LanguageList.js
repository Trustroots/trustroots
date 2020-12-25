// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import * as languageNames from '@/config/languages/languages.json';

export default function LanguageList({ languages = [], className }) {
  const { t } = useTranslation(['languages']);

  return (
    <ul className={className}>
      {languages.map(code => {
        return (
          <li key={code}>
            {languageNames[code]
              ? // i18next-extract-disable-next-line
                t(languageNames[code], { ns: 'languages' })
              : code}
          </li>
        );
      })}
    </ul>
  );
}

LanguageList.propTypes = {
  className: PropTypes.string,
  languages: PropTypes.array.isRequired,
};
