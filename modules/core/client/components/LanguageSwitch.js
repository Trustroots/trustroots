// External dependencies
import { Modal } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import styled from 'styled-components';

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
export default function LanguageSwitch({ buttonStyle = 'default', saveToAPI }) {
  const { t } = useTranslation('core');
  const locales = getLocales();
  const [search, setSearch] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentLanguageCode, setCurrentLanguageCode] = useState(i18n.language);

  const onLanguageChange = async code => {
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
      <button
        title={currentLanguage?.label}
        className={classnames('btn', {
          'btn-primary': buttonStyle === 'primary',
          'btn-default': buttonStyle === 'default',
          'btn-inverse': buttonStyle === 'inverse',
        })}
        onClick={event => {
          event.preventDefault();
          setIsModalVisible(true);
        }}
      >
        {t('Language: {{code}}', {
          code: currentLanguage?.code?.toUpperCase() ?? 'EN',
        })}
      </button>
      <Modal show={isModalVisible} onHide={onModalHide}>
        <Modal.Header closeButton>
          <Modal.Title>{t('Select a language')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {locales.length >= 8 && (
            <SearchInput
              type="search"
              className="form-control"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={t('Search languages…')}
            />
          )}
          <LanguageList>
            {filteredLocales.map(({ code, label }) => (
              <li key={code}>
                {code === currentLanguageCode && (
                  <SelectedLanguage lang={code}>{label}</SelectedLanguage>
                )}
                {code !== currentLanguageCode && (
                  <button
                    className="btn btn-link"
                    dir={i18n.dir(code)}
                    lang={code}
                    onClick={() => {
                      onLanguageChange(code);
                      onModalHide();
                    }}
                  >
                    {label}
                  </button>
                )}
              </li>
            ))}
          </LanguageList>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-default pull-left" onClick={onModalHide}>
            {t('Cancel')}
          </button>
          <small>
            <a
              href="/volunteering"
              onClick={onModalHide}
              className="text-muted"
            >
              {t('Help us translate.')}
            </a>
          </small>
        </Modal.Footer>
      </Modal>
    </>
  );
}

LanguageSwitch.propTypes = {
  buttonStyle: PropTypes.string,
  saveToAPI: PropTypes.bool,
};
