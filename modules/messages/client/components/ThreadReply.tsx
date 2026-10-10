import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import TrEditor from '@/modules/core/client/components/TrEditor';
import { plainTextLength } from '@/modules/core/client/utils/filters';
import { previewMessage } from '../api/messages.api';
import { disableExternalLinks } from '../utils/message-content';
import MessageBubble from './MessageBubble';

type ThreadReplyProps = {
  onSend: (content: string) => Promise<unknown>;
  cacheKey?: string;
  autoFocus?: boolean;
};

export default function ThreadReply({
  onSend,
  cacheKey,
  autoFocus = false,
}: ThreadReplyProps) {
  const { t } = useTranslation('messages');

  const [sending, setSending] = useState(false);
  const [editorKeyCounter, setEditorKeyCounter] = useState(0);
  const [content, setContent] = useState(() => getDraft() || '');
  const [previewing, setPreviewing] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const previewRequest = useRef(0);
  const editButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return () => {
      previewRequest.current += 1;
    };
  }, []);

  useEffect(() => {
    if (previewing) editButton.current?.focus();
  }, [previewing]);

  async function showPreview() {
    const request = ++previewRequest.current;
    setPreviewing(true);
    setPreviewContent(null);
    setPreviewError(false);
    try {
      const formatted = await previewMessage(content);
      if (request === previewRequest.current) setPreviewContent(formatted);
    } catch {
      if (request === previewRequest.current) setPreviewError(true);
    }
  }

  function edit() {
    previewRequest.current += 1;
    setPreviewing(false);
    setEditorKeyCounter(n => n + 1);
  }

  useEffect(() => {
    if (autoFocus || editorKeyCounter > 0) {
      document.getElementById('message-reply-content')?.focus();
    }
  }, [autoFocus, editorKeyCounter]);

  async function send(event: React.SyntheticEvent | KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (sending) {
      return;
    }

    if (plainTextLength(content) === 0) {
      return;
    }

    setSending(true);
    const sent = await onSend(content);

    // Clear only when really sent to avoid data loss
    if (sent) {
      previewRequest.current += 1;
      setPreviewing(false);
      setContent('');
      // There is a bug somewhere that means just setting content to '' does not
      // set the text in the editor after pressing send, we can work around that by
      // recreating the TrEditor component after each send by setting a fresh key
      setEditorKeyCounter(n => n + 1);
      clearDraft();
    }

    setSending(false);
  }

  function onChange(text: string) {
    saveDraft(text);
    setContent(text);
  }

  function saveDraft(text: string) {
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
      <div className="row message-reply-editor-row">
        <div className="col-xs-12">
          {previewing ? (
            <section
              className="message-draft-preview"
              aria-label={t<string>('Message preview')}
              aria-live="polite"
            >
              <small className="text-muted">
                {t<string>('Message preview')}
              </small>
              {previewError ? (
                <div role="alert">
                  <p>
                    {t<string>('Failed to load preview. Please try again.')}
                  </p>
                  <button
                    type="button"
                    className="btn btn-default"
                    disabled={sending}
                    onClick={showPreview}
                  >
                    {t<string>('Retry')}
                  </button>
                </div>
              ) : previewContent === null ? (
                <p role="status">{t<string>('Loading preview…')}</p>
              ) : (
                <MessageBubble className="message-sender-me">
                  <div className="message-main">
                    <div className="panel panel-default">
                      <div
                        className="panel-body"
                        dangerouslySetInnerHTML={{
                          __html: disableExternalLinks(previewContent),
                        }}
                      />
                    </div>
                  </div>
                </MessageBubble>
              )}
            </section>
          ) : (
            <div className="panel panel-default">
              <TrEditor
                key={editorKeyCounter}
                id="message-reply-content"
                text={content}
                onChange={text => onChange(text)}
                onCtrlEnter={event => send(event)}
              />
            </div>
          )}
        </div>
      </div>
      <div className="col-xs-2 col-sm-12 message-reply-actions">
        <button
          ref={editButton}
          type="button"
          className="btn btn-default message-preview-toggle"
          aria-pressed={previewing}
          disabled={sending || (!previewing && plainTextLength(content) === 0)}
          onClick={previewing ? edit : showPreview}
        >
          {previewing ? t<string>('Edit') : t<string>('Preview')}
        </button>
        <small className="text-muted hidden-xs">
          {t<string>(
            'Highlight text to add links or change its appearance. Ctrl+Enter to send.',
          )}
        </small>
        <button
          id="messageReplySubmit"
          className="btn btn-md btn-primary message-reply-btn"
          type="submit"
          disabled={sending}
        >
          <i className="icon-send" />
          <span className="hidden-xs">&nbsp;{t<string>('Send')}</span>
        </button>
      </div>
    </form>
  );
}

ThreadReply.propTypes = {
  onSend: PropTypes.func.isRequired,
  cacheKey: PropTypes.string,
  autoFocus: PropTypes.bool,
};
