import PropTypes from 'prop-types';
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function QuickReply({ onSend, onFocus }) {
  const { t } = useTranslation('messages');

  // It's not quite clear to me how to handle the i18n of
  // these messages. They are a bit of a hack to start with.
  // They rely on the "data-hosting" attribute being set on the
  // p element, but it still has message content that will not
  // be translated later, it's stuck at it's original content.
  // I chose to write the message content in the language the
  // user has set.
  // Probably better would be not to include any message content,
  // but to handle "special" messages properly.
  const replies = [
    {
      host: true,
      content: t('Yes, I can host!'),
    },
    {
      host: false,
      content: t("Sorry I can't host"),
    },
    {
      write: true,
      content: t('Write back'),
    },
  ];

  return (
    <div
      className="btn-toolbar"
      id="message-quick-reply"
      data-testid="quick-reply"
    >
      {replies.map(({ write, host, content }) => {
        const className = write
          ? 'btn-offer-meet'
          : `btn-offer-hosting-${host ? 'yes' : 'no'}`;

        function onClick() {
          if (write) {
            onFocus();
          } else {
            onSend(`
              <p data-hosting="${host ? 'yes' : 'no'}">
                <b><i>${content}</i></b>
              </p>
            `);
          }
        }

        return (
          <button
            key={content}
            className={`btn btn-sm ${className}`}
            onClick={onClick}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

QuickReply.propTypes = {
  onSend: PropTypes.func.isRequired,
  onFocus: PropTypes.func.isRequired,
};
