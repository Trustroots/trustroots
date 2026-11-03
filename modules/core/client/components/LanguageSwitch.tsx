// External dependencies
import { useTranslation } from 'react-i18next';
import { Button, type ButtonStyleProps } from '@trustroots/ui/Button';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@trustroots/ui/Modal';
import React, { useState } from 'react';
import styled from 'styled-components';

// Internal dependencies
import {
  getLocales,
  getSearchedLocales,
} from '@/modules/core/client/utils/locales';
import {
  toAnalyticsLanguage,
  useAnalytics,
} from '@trustroots/analytics/client';
import * as usersApi from '@/modules/users/client/api/users.api';
import i18n from '@/config/client/i18n';

const buttonLooks = {
  default: {},
  inverse: { variant: 'outline', intent: 'inverse' },
} satisfies Record<string, ButtonStyleProps>;

const SelectedLanguage = styled.strong`
  padding: 7px 13px;
  font-size: 14px;
  display: inline-block;
`;

const LanguageList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-gap: 10px;

  @media (max-width: 480px) {
    grid-template-columns: 100%;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  max-width: 250px;
  margin-bottom: 10px;
`;

/**
 * LanguageSwitch component.
 * @param {String} buttonStyle - Button style: default, or inverse on the green header
 * @param {Boolean} [saveToAPI=false] - should we save selected language to API?
 */
type LanguageSwitchProps = {
  buttonStyle?: keyof typeof buttonLooks;
  saveToAPI?: boolean;
};
export default function LanguageSwitch({
  buttonStyle = 'default',
  saveToAPI,
}: LanguageSwitchProps) {
  const { t } = useTranslation('core');
  const { track } = useAnalytics();
  const locales = getLocales();
  const [search, setSearch] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentLanguageCode, setCurrentLanguageCode] = useState(i18n.language);

  const onLanguageChange = async (code: string) => {
    setCurrentLanguageCode(code);
    i18n.changeLanguage(code);

    // Save the user's choice to API. The interface has switched either way,
    // so a failed save only means the next visit starts in the old language.
    let saved = false;
    if (saveToAPI) {
      try {
        await usersApi.update({ locale: code });
        saved = true;
      } catch {
        // Reported as a failed API request; nothing to show here.
      }
    }

    track('language_switched', {
      language: toAnalyticsLanguage(code),
      saved: saved ? 'yes' : 'no',
    });
  };

  // selected language
  const currentLanguage = locales.find(
    ({ code }) => code === currentLanguageCode,
  );

  const filteredLocales = search
    ? getSearchedLocales(locales, search)
    : locales;

  const onModalHide = () => {
    setIsModalVisible(false);
  };

  return (
    <>
      <Button
        title={currentLanguage?.label}
        {...buttonLooks[buttonStyle]}
        className="text-nowrap"
        onClick={event => {
          event.preventDefault();
          setIsModalVisible(true);
        }}
      >
        {currentLanguage?.label ?? 'English'}
      </Button>
      <Modal open={isModalVisible} onClose={onModalHide}>
        <ModalHeader closeLabel={t('Close')}>
          <ModalTitle>{t('Select a language')}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {locales.length >= 8 && (
            <SearchInput
              type="search"
              className="form-control"
              value={search}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setSearch(event.target.value)
              }
              placeholder={t('Search languages…')}
            />
          )}
          <LanguageList>
            {filteredLocales.map(({ code, label }, index) => (
              <li key={`${code}-${label}-${index}`}>
                {code === currentLanguageCode && (
                  <SelectedLanguage lang={code}>{label}</SelectedLanguage>
                )}
                {code !== currentLanguageCode && (
                  <Button
                    variant="link"
                    dir={i18n.dir(code)}
                    lang={code}
                    onClick={() => {
                      onLanguageChange(code);
                      onModalHide();
                    }}
                  >
                    {label}
                  </Button>
                )}
              </li>
            ))}
          </LanguageList>
        </ModalBody>
        <ModalFooter>
          <Button className="pull-left" onClick={onModalHide}>
            {t('Cancel')}
          </Button>
          <small>
            <a
              href="https://team.trustroots.org/"
              onClick={onModalHide}
              className="text-muted"
            >
              {t('Help us translate.')}
            </a>
          </small>
        </ModalFooter>
      </Modal>
    </>
  );
}
