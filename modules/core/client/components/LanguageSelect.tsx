// External dependencies
import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, type ComponentProps } from 'react';
import { Alert } from '@trustroots/ui/Alert';
import { MultiCombobox } from '@trustroots/ui/MultiCombobox';

// Internal dependencies
import { useLanguagesQuery, type LanguageOption } from '../api/languages.api';
import { normaliseForSearch } from '../utils/locales';

const INPUT_MIN_LENGTH = 2;

function filterLanguagesByLabel(
  languages: LanguageOption[],
  inputValue: string,
): LanguageOption[] {
  const query = normaliseForSearch(inputValue);
  return languages.filter(language =>
    normaliseForSearch(language.label).includes(query),
  );
}

type LanguageSelectProps = Pick<
  ComponentProps<'input'>,
  'aria-label' | 'aria-labelledby' | 'placeholder'
> & {
  excludeDeprecated?: boolean;
  preSelectedLanguages?: string[];
  onChangeLanguages?: (languages: string[]) => void;
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
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (data && preSelectedLanguages?.length) {
      const prefill = data.filter(({ value }) =>
        preSelectedLanguages.includes(value),
      );
      setSelected(prefill);
    }
  }, [data]);

  const languages = data ?? [];
  const options = excludeDeprecated
    ? languages.filter(language => !language.deprecated)
    : languages;
  const canSearch = inputValue.length >= INPUT_MIN_LENGTH;
  const filtered = canSearch ? filterLanguagesByLabel(options, inputValue) : [];

  return (
    <>
      <MultiCombobox
        items={options}
        filteredItems={filtered}
        disabled={!data || isError}
        value={selected}
        inputValue={inputValue}
        onInputValueChange={setInputValue}
        onValueChange={value => {
          setSelected(value);
          onChangeLanguages?.(value.map(option => option.value));
        }}
        emptyMessage={
          canSearch
            ? t('No languages found; try typing something else.')
            : t('Start typing a language…')
        }
        removeLabel={option =>
          t('Remove {{language}}', { language: option.label })
        }
        placeholder={isLoading ? t('Loading…') : placeholder || t('Select…')}
        {...props}
      />
      {isError && (
        <Alert intent="warning" role="alert">
          {t(
            'Snap! Something went wrong. If this keeps happening, please contact us.',
          )}
        </Alert>
      )}
    </>
  );
}
