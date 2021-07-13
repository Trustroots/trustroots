// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

import LanguageSelect from '@/modules/core/client/components/LanguageSelect';

const queryClient = new QueryClient();

export default function LanguagesPanel({ profileLanguages = [] }) {
  const { t } = useTranslation('users');

  return (
    <QueryClientProvider client={queryClient}>
      <div className="form-group">
        <label className="col-sm-3 text-right control-label">
          {t('Languages')}
        </label>
        <div className="col-sm-9 col-md-7 col-lg-6">
          {/*
        <div
          tr-languages="profileEditAbout.user.languages"
          ng-change="profileEdit.unsavedModifications = true"
          aria-labelledby="label-languages"
        ></div>
        */}
          <LanguageSelect
            aria-label={t('Add languages you speak.')}
            languages={profileLanguages}
          />
          <p className="help-block">{t('Add languages you speak.')}</p>
        </div>
      </div>
    </QueryClientProvider>
  );
}

LanguagesPanel.propTypes = {
  profileLanguages: PropTypes.array.isRequired,
};
