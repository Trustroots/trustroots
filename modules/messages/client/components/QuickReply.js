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
            onSend(`
              <p data-hosting="${host ? 'yes' : 'no'}">
                <b><i>${t(content)}</i></b>
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
