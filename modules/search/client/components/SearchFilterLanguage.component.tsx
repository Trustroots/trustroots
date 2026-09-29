// External dependencies
import { useTranslation } from 'react-i18next';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

// Internal dependencies
import LanguageSelect from '@/modules/core/client/components/LanguageSelect';

const queryClient = new QueryClient();

export default function SearchFilterLanguage({
  onChangeLanguages,
  preSelectedLanguages,
}: {
  onChangeLanguages: (languages: string[]) => void;
  preSelectedLanguages: string[];
}) {
  const { t } = useTranslation('search');

  return (
    <QueryClientProvider client={queryClient}>
      <h4 id="filter-languages">{String(t('Spoken languages'))}</h4>
      <LanguageSelect
        aria-labelledby="filter-languages"
        onChangeLanguages={onChangeLanguages}
        placeholder={String(t('Select languages…'))}
        preSelectedLanguages={preSelectedLanguages}
      ></LanguageSelect>
    </QueryClientProvider>
  );
}
