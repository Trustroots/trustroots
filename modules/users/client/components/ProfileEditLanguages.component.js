// External dependencies
import { useTranslation } from 'react-i18next';
import { QueryClient, QueryClientProvider } from 'react-query';
import PropTypes from 'prop-types';
import React from 'react';

import { broadcastClientEvent } from '@/modules/core/client/services/client-runtime';
import LanguageSelect from '@/modules/core/client/components/LanguageSelect';

const queryClient = new QueryClient();

export default function ProfileEditLanguages({
  onChangeLanguages,
  profileLanguages = [],
}) {
  const { t } = useTranslation('users');

  // Keep the parent profile form in sync with language changes.
  const onChange = languages => {
    broadcastClientEvent('userChanged');
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
            onChangeLanguages={onChange}
            placeholder={t('Add languages you speak.')}
            aria-label={t('Add languages you speak.')}
            preSelectedLanguages={profileLanguages}
          />
        </QueryClientProvider>
      </div>
    </div>
  );
}

ProfileEditLanguages.propTypes = {
  onChangeLanguages: PropTypes.func.isRequired,
  profileLanguages: PropTypes.array.isRequired,
};
