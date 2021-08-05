// External dependencies
import { matchSorter } from 'match-sorter';
import { useTranslation } from 'react-i18next';
import AsyncSelect from 'react-select/async';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';

// Internal dependencies
import { useLanguagesQuery } from '../api/languages.api';

const INPUT_MIN_LENGTH = 2;

export default function LanguageSelect({
  preSelectedLanguages = [],
  placeholder,
  onChangeLanguages,
  ...props
}) {
  const { t } = useTranslation('core');
  const { data, isLoading, isError } = useLanguagesQuery({
    format: 'array',
  });
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (data && preSelectedLanguages?.length) {
      const prefill = data.filter(({ value }) =>
        preSelectedLanguages.includes(value),
      );
      setSelected(prefill);
    }
  }, [data]);

  const filteredLanguages = inputValue =>
    new Promise(resolve => {
      if (!inputValue || inputValue.length < INPUT_MIN_LENGTH) {
        return resolve([]);
      }

      const res = matchSorter(data, inputValue, { keys: ['label'] });
      resolve(res);
    });

  const onChange = selectedOptions => {
    if (onChangeLanguages) {
      const languageCodes =
        selectedOptions && selectedOptions.length
          ? selectedOptions.map(({ value }) => value)
          : [];
      onChangeLanguages(languageCodes);
    }
    setSelected(selectedOptions);
  };

  return (
    <>
      <AsyncSelect
        isDisabled={!data || isError}
        isLoading={isLoading}
        isMulti
        value={selected}
        loadingMessage={() => t('Loading…')}
        noOptionsMessage={({ inputValue }) => {
          return inputValue?.length >= INPUT_MIN_LENGTH
            ? t('No languages found; try typing something else.')
            : t('Start typing a language…');
        }}
        placeholder={placeholder || t('Select…')}
        onChange={onChange}
        loadOptions={filteredLanguages}
        {...props}
      />
      {isError && (
        <div className="alert alert-warning" role="alert">
          {t(
            'Snap! Something went wrong. If this keeps happening, please contact us.',
          )}
        </div>
      )}
    </>
  );
}

LanguageSelect.propTypes = {
  onChangeLanguages: PropTypes.func,
  placeholder: PropTypes.string,
  preSelectedLanguages: PropTypes.array,
};
