import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Rules text component that adds our rules as paragraphs.
 * Usage: `<RulesText />`
 */
export default function RulesText() {
  const { t } = useTranslation('pages');

  return (
    <>
      {/*
       * Don't add links to this text.
       * This is embedded also at modal-popup at signup form.
       * Clicking links there would just break the signup-flow.
       */}

      <p>
        {t(
          'We want a world that encourages trust, adventure and intercultural connections. For that to happen through Trustroots we have written down some basic rules that apply to everyone. Please respect these rules:',
        )}
      </p>

      <ul>
        <li>
          {t('Be friendly and know when to stop messaging someone.')}{' '}
          {t('We have no tolerance for abusive members.')}
        </li>
        <li>
          {t(
            'We have no tolerance for spam, ads and other objectionable content.',
          )}
        </li>
        <li>
          {t(
            'Be a human being: write messages specifically for their recipient.',
          )}
        </li>
        <li>
          {t(
            "Respect copyrights: stay within your rights if you want to share other people's texts and images - check their legal status!",
          )}
        </li>
        <li>
          {t(
            'Make your own profile. One person, one profile — use your alias or real name; but never impersonate someone else, real or imaginary.',
          )}
        </li>
        <li>{t('Be yourself, helpful, kind, responsible.')}</li>
        <li>
          {t(
            'Be respectful of others and restrain from any kind of abusive behaviour.',
          )}
        </li>
      </ul>

      <p>
        {t(
          'If you ignore these rules, we might stop our services for you without further notice.',
        )}
      </p>

      <p>
        {t(
          "We try to keep our rules simple and we value transparency. We'll update these rules as needed.",
        )}
      </p>
    </>
  );
}

RulesText.propTypes = {};
