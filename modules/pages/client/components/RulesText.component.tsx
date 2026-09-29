import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Rules text component that adds our rules as paragraphs.
 * Usage: `<RulesText />`
 */
export default function RulesText() {
  const { t } = useTranslation('pages');
  const text = (key: string) => t(key) as string;

  return (
    <>
      {/*
       * Don't add links to this text.
       * This is embedded also at modal-popup at signup form.
       * Clicking links there would just break the signup-flow.
       */}

      <p>
        {text(
          'We want a world that encourages trust, adventure and intercultural connections. For that to happen through Trustroots we have written down some basic rules that apply to everyone. Please respect these rules:',
        )}
      </p>

      <ul>
        <li>
          {text('Be friendly and know when to stop messaging someone.')}{' '}
          {text('We have no tolerance for abusive members.')}
        </li>
        <li>
          {text(
            'We have no tolerance for spam, ads and other objectionable content.',
          )}
        </li>
        <li>
          {text(
            'Be a human being: write messages specifically for their recipient.',
          )}
        </li>
        <li>
          {text(
            "Respect copyrights: stay within your rights if you want to share other people's texts and images - check their legal status!",
          )}
        </li>
        <li>
          {text(
            'Make your own profile. One person, one profile — use your alias or real name; but never impersonate someone else, real or imaginary.',
          )}
        </li>
        <li>{text('Be yourself, helpful, kind, responsible.')}</li>
        <li>
          {text(
            'Be respectful of others and restrain from any kind of abusive behaviour.',
          )}
        </li>
        <li>
          {text(
            "Our currency is hospitality: don't ask or accept any form of monetary exchange to use Trustroots.",
          )}
        </li>
      </ul>

      <p>
        {text(
          'If you ignore these rules, we might stop our services for you without further notice.',
        )}
      </p>

      <p>
        {text(
          "We try to keep our rules simple and we value transparency. We'll update these rules as needed.",
        )}
      </p>
    </>
  );
}
