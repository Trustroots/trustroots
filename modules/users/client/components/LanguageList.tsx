// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import { useLanguagesQuery } from '@/modules/core/client/api/languages.api';

export default function LanguageList({
  languages = [],
  className,
  emphasisedLanguages = [],
}: {
  languages?: string[];
  className?: string;
  emphasisedLanguages?: string[];
}) {
  const { t } = useTranslation(['languages']) as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const { data: languageNames, isLoading } = useLanguagesQuery() as {
    data?: Record<string, string>;
    isLoading: boolean;
  };

  if (isLoading || !languages.length) {
    return null;
  }

  return (
    <ul className={className}>
      {languages.map(code => {
        const name = languageNames?.[code]
          ? // i18next-extract-disable-next-line
            t(languageNames[code], { ns: 'languages' })
          : code;
        return (
          <li key={code}>
            {emphasisedLanguages.includes(code) ? (
              <strong>{name}</strong>
            ) : (
              name
            )}
          </li>
        );
      })}
    </ul>
  );
}

LanguageList.propTypes = {
  className: PropTypes.string,
  languages: PropTypes.array.isRequired,
  emphasisedLanguages: PropTypes.arrayOf(PropTypes.string),
};
