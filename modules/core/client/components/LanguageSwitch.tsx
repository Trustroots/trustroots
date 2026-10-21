// External dependencies
import { Modal } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import styled from 'styled-components';
import { Button, type ButtonVariant } from '@trustroots/ui';

// Internal dependencies
import {
  getLocales,
  getSearchedLocales,
} from '@/modules/core/client/utils/locales';
import * as usersApi from '@/modules/users/client/api/users.api';
import i18n from '@/config/client/i18n';

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
 * @param {String} buttonStyle - Button style: inverse, default, primary
 * @param {Boolean} [saveToAPI=false] - should we save selected language to API?
 */
type LanguageSwitchProps = {
  buttonStyle?: ButtonVariant;
  saveToAPI?: boolean;
};
export default function LanguageSwitch({
  buttonStyle = 'default',
  saveToAPI,
}: LanguageSwitchProps) {
  const { t } = useTranslation('core');
  const locales = getLocales();
  const [search, setSearch] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentLanguageCode, setCurrentLanguageCode] = useState(i18n.language);

  const onLanguageChange = async (code: string) => {
    setCurrentLanguageCode(code);
    i18n.changeLanguage(code);

    // Save the user's choice to API.
    if (saveToAPI) {
      await usersApi.update({ locale: code });
    }
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
        variant={buttonStyle}
        className="text-nowrap"
        onClick={event => {
          event.preventDefault();
          setIsModalVisible(true);
        }}
      >
        {currentLanguage?.label ?? 'English'}
      </Button>
      <Modal show={isModalVisible} onHide={onModalHide}>
        <Modal.Header closeButton>
          <Modal.Title>{t<string>('Select a language')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {locales.length >= 8 && (
            <SearchInput
              type="search"
              className="form-control"
              value={search}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setSearch(event.target.value)
              }
              placeholder={t<string>('Search languages…')}
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
        </Modal.Body>
        <Modal.Footer>
          <Button variant="default" className="pull-left" onClick={onModalHide}>
            {t<string>('Cancel')}
          </Button>
          <small>
            <a
              href="https://team.trustroots.org/"
              onClick={onModalHide}
              className="text-muted"
            >
              {t<string>('Help us translate.')}
            </a>
          </small>
        </Modal.Footer>
      </Modal>
    </>
  );
}
