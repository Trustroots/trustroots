// External dependencies
import { matchSorter } from 'match-sorter';
import { useTranslation } from 'react-i18next';
import AsyncSelect from 'react-select/async';
import type { OnChangeValue } from 'react-select';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';

// Internal dependencies
import { useLanguagesQuery, type LanguageOption } from '../api/languages.api';

const INPUT_MIN_LENGTH = 2;
type LanguageSelectProps = {
  excludeDeprecated?: boolean;
  preSelectedLanguages?: string[];
  placeholder?: string;
  onChangeLanguages?: (languages: string[]) => void;
  [key: string]: unknown;
};

export default function LanguageSelect({
  excludeDeprecated = false,
  preSelectedLanguages = [],
  placeholder,
  onChangeLanguages,
  ...props
}: LanguageSelectProps) {
  const { t } = useTranslation('core');
  const { data, isLoading, isError } = useLanguagesQuery({
    format: 'array',
  });
  const [selected, setSelected] = useState<LanguageOption[]>([]);

  useEffect(() => {
    if (data && preSelectedLanguages?.length) {
      const prefill = data.filter(({ value }) =>
        preSelectedLanguages.includes(value),
      );
      setSelected(prefill);
    }
  }, [data]);

  const filteredLanguages = (inputValue: string): Promise<LanguageOption[]> =>
    new Promise(resolve => {
      if (!inputValue || inputValue.length < INPUT_MIN_LENGTH) {
        return resolve([]);
      }

      const languages = data || [];
      const options = excludeDeprecated
        ? languages.filter(language => !language.deprecated)
        : languages;
      const res = matchSorter(options, inputValue, { keys: ['label'] });
      resolve(res);
    });

  const onChange = (selectedOptions: OnChangeValue<LanguageOption, true>) => {
    if (onChangeLanguages) {
      const languageCodes =
        selectedOptions && selectedOptions.length
          ? selectedOptions.map(({ value }) => value)
          : [];
      onChangeLanguages(languageCodes);
    }
    setSelected(selectedOptions ? [...selectedOptions] : []);
  };

  return (
    <>
      <AsyncSelect
        isDisabled={!data || isError}
        isLoading={isLoading}
        isMulti
        value={selected}
        loadingMessage={() => t<string>('Loading…')}
        noOptionsMessage={({ inputValue }) => {
          return inputValue?.length >= INPUT_MIN_LENGTH
            ? t<string>('No languages found; try typing something else.')
            : t<string>('Start typing a language…');
        }}
        placeholder={placeholder || t<string>('Select…')}
        onChange={onChange}
        loadOptions={filteredLanguages}
        {...props}
      />
      {isError && (
        <div className="alert alert-warning" role="alert">
          {t<string>(
            'Snap! Something went wrong. If this keeps happening, please contact us.',
          )}
        </div>
      )}
    </>
  );
}

LanguageSelect.propTypes = {
  excludeDeprecated: PropTypes.bool,
  onChangeLanguages: PropTypes.func,
  placeholder: PropTypes.string,
  preSelectedLanguages: PropTypes.array,
};
