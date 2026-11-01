import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui/Button';

type QuickReplyProps = {
  onSend: (content: string) => void;
  onFocus: () => void;
};

export default function QuickReply({ onSend, onFocus }: QuickReplyProps) {
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
      className="tw:flex tw:flex-wrap tw:justify-start"
      id="message-quick-reply"
      data-testid="quick-reply"
    >
      {replies.map(({ write, host, content }) => {
        const colour = write ? 'meet' : host ? 'yes' : 'no';

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
          <Button
            key={content}
            variant="offer"
            colour={colour}
            size="sm"
            onClick={onClick}
          >
            {content}
          </Button>
        );
      })}
    </div>
  );
}
