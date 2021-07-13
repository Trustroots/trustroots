// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import Select from 'react-select';

// Internal dependencies
import { useLanguagesQuery } from '../api/languages.api';

export default function LanguageSelect({
  preSelectedLanguages = [],
  ...props
}) {
  const { t } = useTranslation('core');
  const { data, isLoading, isError } = useLanguagesQuery({
    format: 'array',
  });
  const [selected, setSelected] = useState(preSelectedLanguages);

  return (
    <>
      <Select
        isDisabled={isError}
        isLoading={isLoading}
        isMulti
        loadingMessage={t('Loading')}
        noOptionsMessage={t('No languages found')}
        onChange={values => {
          // Pick only array of language codes
          const languageCodes = values.map(({ value }) => value);
          setSelected(languageCodes);
        }}
        options={data}
        {...props}
      />
      <pre>{JSON.stringify(preSelectedLanguages)}</pre>
      <pre>{JSON.stringify(selected)}</pre>
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
  labelledBy: PropTypes.string,
  preSelectedLanguages: PropTypes.array,
};
