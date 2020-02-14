import PropTypes from 'prop-types';
import React from 'react';
import { useTranslation } from 'react-i18next';

const replies = [
  {
    host: true,
    content: 'Yes, I can host!',
  },
  {
    host: false,
    content: "Sorry I can't host",
  },
  {
    write: true,
    content: 'Write back',
  },
];

export default function QuickReply({ onSend, onFocus }) {
  const { t } = useTranslation('messages');
  return (
    <div className="btn-toolbar" id="message-quick-reply">
      {replies.map(({ write, host, content }) => {
        const className = write
          ? 'btn-offer-meet'
          : `btn-offer-hosting-${host ? 'yes' : 'no'}`;

        function onClick() {
          if (write) {
            onFocus();
          } else {
            // we write the english content into the message
            // potentially we auto-translate those "special"
            // messages at some point
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
            {t(content)}
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
