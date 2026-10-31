// External dependencies
import { useTranslation } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import LanguageSelect from '@/modules/core/client/components/LanguageSelect';

import {
  languageLevelLabels,
  type LanguageLevels,
  type LanguageLevel,
} from '../../shared/language-levels';
import { useLanguagesQuery } from '@/modules/core/client/api/languages.api';

function LevelSelectors({
  languages,
  levels,
  onChange,
}: {
  languages: string[];
  levels: LanguageLevels;
  onChange: (levels: LanguageLevels) => void;
}) {
  const { t } = useTranslation(['users', 'languages']);
  const { data: names } = useLanguagesQuery();
  return languages.map(code => (
    <div key={code}>
      <label htmlFor={`language-level-${code}`}>
        {t('Level for {{language}}', {
          // i18next-extract-disable-next-line
          language: names?.[code] ? t(names[code], { ns: 'languages' }) : code,
        })}
      </label>
      <select
        id={`language-level-${code}`}
        className="form-control"
        value={levels[code] || ''}
        onChange={event => {
          const next = { ...levels };
          if (event.target.value)
            next[code] = event.target.value as LanguageLevel;
          else delete next[code];
          onChange(next);
        }}
      >
        <option value="">{t('Not specified')}</option>
        {Object.entries(languageLevelLabels).map(([value, label]) => (
          // i18next-extract-disable-next-line
          <option key={value} value={value}>
            {t(label)}
          </option>
        ))}
      </select>
    </div>
  ));
}

const queryClient = new QueryClient();

export default function ProfileEditLanguages({
  onChangeLanguages,
  profileLanguages = [],
  languageLevels = {},
  onChangeLevels,
}: {
  onChangeLanguages: (languages: string[]) => void;
  profileLanguages?: string[];
  languageLevels?: LanguageLevels;
  onChangeLevels?: (levels: LanguageLevels) => void;
}) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  // Keep the parent profile form in sync with language changes.
  const onChange = (languages: string[]) => {
    onChangeLevels?.(
      Object.fromEntries(
        Object.entries(languageLevels).filter(([code]) =>
          languages.includes(code),
        ),
      ),
    );
    if (onChangeLanguages) {
      onChangeLanguages(languages);
    }
  };

  return (
    <div className="form-group">
      <label className="col-sm-3 text-right control-label">
        {t('Languages')}
      </label>
      <div className="col-sm-9 col-md-7 col-lg-6">
        <QueryClientProvider client={queryClient}>
          <LanguageSelect
            excludeDeprecated
            onChangeLanguages={onChange}
            placeholder={t('Add languages you speak.')}
            aria-label={t('Add languages you speak.')}
            preSelectedLanguages={profileLanguages}
          />
          {onChangeLevels && (
            <LevelSelectors
              languages={profileLanguages}
              levels={languageLevels}
              onChange={onChangeLevels}
            />
          )}
        </QueryClientProvider>
      </div>
    </div>
  );
}
