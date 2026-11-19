// External dependencies
import { useTranslation } from 'react-i18next';
import { Button, type ButtonStyleProps } from '@trustroots/ui/Button';
import { Input } from '@trustroots/ui/Input';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@trustroots/ui/Modal';
import React, { useState } from 'react';

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

const languageChoiceClass =
  'tw:flex tw:h-full tw:min-h-11 tw:w-full tw:items-center tw:rounded-(--bs-border-radius) tw:border-0 tw:px-3 tw:py-2.5 tw:text-start tw:text-[length:inherit] tw:leading-[1.5] tw:wrap-anywhere';

const buttonLooks = {
  default: {},
  inverse: { variant: 'outline', intent: 'inverse' },
} satisfies Record<string, ButtonStyleProps>;

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
      <Modal open={isModalVisible} onClose={onModalHide} size="lg" scrollable>
        <ModalHeader closeLabel={t('Close')}>
          <ModalTitle>{t('Select a language')}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {locales.length >= 8 && (
            <Input
              fieldSize="sm"
              className="tw:mb-4"
              type="search"
              value={search}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setSearch(event.target.value)
              }
              placeholder={t('Search languages…')}
              aria-label={t('Search languages…')}
            />
          )}
          <ul className="tw:m-0 tw:grid tw:list-none tw:grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] tw:gap-x-3 tw:gap-y-1 tw:p-0">
            {filteredLocales.map(({ code, label }, index) => (
              <li key={`${code}-${label}-${index}`}>
                {code === currentLanguageCode && (
                  <strong
                    className={`${languageChoiceClass} tw:bg-(--tr-gray-lighter) tw:text-link tw:after:ms-auto tw:after:ps-2 tw:after:content-['✓']`}
                    lang={code}
                    dir={i18n.dir(code)}
                    aria-current="true"
                  >
                    {label}
                  </strong>
                )}
                {code !== currentLanguageCode && (
                  <button
                    className={`${languageChoiceClass} tw:cursor-pointer tw:bg-transparent tw:text-text tw:[&:hover]:bg-(--tr-gray-lighter) tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-offset-2 tw:focus-visible:outline-link`}
                    type="button"
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
          </ul>
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
