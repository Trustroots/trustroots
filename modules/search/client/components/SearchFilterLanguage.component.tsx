// External dependencies
import { useTranslation } from 'react-i18next';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import PropTypes from 'prop-types';

// Internal dependencies
import LanguageSelect from '@/modules/core/client/components/LanguageSelect';

const queryClient = new QueryClient();

export default function SearchFilterLanguage({
  onChangeLanguages,
  preSelectedLanguages,
}) {
  const { t } = useTranslation('search');

  return (
    <QueryClientProvider client={queryClient}>
      <h4 id="filter-languages">{t('Spoken languages')}</h4>
      <LanguageSelect
        aria-labelledby="filter-languages"
        onChangeLanguages={onChangeLanguages}
        placeholder={t('Select languages…')}
        preSelectedLanguages={preSelectedLanguages}
      ></LanguageSelect>
    </QueryClientProvider>
  );
}

SearchFilterLanguage.propTypes = {
  onChangeLanguages: PropTypes.func.isRequired,
  preSelectedLanguages: PropTypes.array,
};
