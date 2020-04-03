import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import TrEditor from '@/modules/core/client/components/TrEditor';
import plainTextLength from '@/modules/core/client/filters/plain-text-length.client.filter';

export default function ThreadReply({ onSend, cacheKey }) {
  const { t } = useTranslation('messages');

  const [editorKeyCounter, setEditorKeyCounter] = useState(0);
  const [content, setContent] = useState(() => getDraft() || '');

  function send(event) {
    event.preventDefault();
    event.stopPropagation();
    if (plainTextLength(content) > 0) {
      onSend(content);
      setContent('');
      // There is a bug somewhere that means just setting content to '' does not
      // set the text in the editor after pressing send, we can work around that by
      // recreating the TrEditor component after each send by setting a fresh key
      setEditorKeyCounter(n => n + 1);
      clearDraft();
    }
  }

  function onChange(text) {
    saveDraft(text);
    setContent(text);
  }

  function saveDraft(text) {
    if (window.localStorage && cacheKey) {
      window.localStorage.setItem(cacheKey, text);
    }
  }

  function getDraft() {
    if (window.localStorage && cacheKey) {
      return window.localStorage.getItem(cacheKey);
    } else {
      return null;
    }
  }

  function clearDraft() {
    if (window.localStorage && cacheKey) {
      window.localStorage.removeItem(cacheKey);
    }
  }

  return (
    <form
      id="message-reply"
      name="messageForm"
      className="form-horizontal"
      onSubmit={event => send(event)}
    >
      <div className="row">
        <div className="col-xs-12">
          <div className="panel panel-default">
            <TrEditor
              key={editorKeyCounter}
              id="message-reply-content"
              text={content}
              onChange={text => onChange(text)}
              onCtrlEnter={event => send(event)}
            />
          </div>
        </div>
      </div>
      <div className="col-xs-2 col-sm-12">
        <small className="text-muted hidden-xs">
          {t(
            'Highlight text to add links or change its appearance. Ctrl+Enter to send.',
          )}
        </small>
        <button
          id="messageReplySubmit"
          className="btn btn-md btn-primary message-reply-btn"
          type="submit"
        >
          <i className="icon-send" />
          <span className="hidden-xs">&nbsp;{t('Send')}</span>
        </button>
      </div>
    </form>
  );
}

ThreadReply.propTypes = {
  onSend: PropTypes.func.isRequired,
  cacheKey: PropTypes.string,
};
