// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';

import { $broadcast } from '@/modules/core/client/services/angular-compat';
import LanguageSelect from '@/modules/core/client/components/LanguageSelect';

export default function ProfileEditLanguages({
  onChangeLanguages,
  profileLanguages = [],
}) {
  const { t } = useTranslation('users');

  // Wrapper to `onChangeLanguages` which is passed from Angular controller
  // We add additional Angular broadcast here in order to communicate to higher-up Angular controller
  const onChange = languages => {
    $broadcast('userChanged');
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
        <LanguageSelect
          onChangeLanguages={onChange}
          placeholder={t('Add languages you speak.')}
          aria-label={t('Add languages you speak.')}
          preSelectedLanguages={profileLanguages}
        />
      </div>
    </div>
  );
}

ProfileEditLanguages.propTypes = {
  onChangeLanguages: PropTypes.func.isRequired,
  profileLanguages: PropTypes.array.isRequired,
};
