import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import TrEditor from '@/modules/core/client/components/TrEditor';
import { plainTextLength } from '@/modules/core/client/utils/filters';
import { previewMessage } from '../api/messages.api';
import RichText from '@/modules/core/client/components/RichText';
import MessageBubble from './MessageBubble';

type ThreadReplyProps = {
  onSend: (content: string) => Promise<unknown>;
  cacheKey?: string;
  autoFocus?: boolean;
  disabled?: boolean;
};

export default function ThreadReply({
  onSend,
  cacheKey,
  autoFocus = false,
  disabled = false,
}: ThreadReplyProps) {
  const { t } = useTranslation('messages');

  const [sending, setSending] = useState(false);
  const [composerHeight, setComposerHeight] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const drag = useRef<{ y: number; height: number } | null>(null);
  const [editorKeyCounter, setEditorKeyCounter] = useState(0);
  const [content, setContent] = useState(() => getDraft() || '');
  const [previewing, setPreviewing] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const previewRequest = useRef(0);
  const editButton = useRef<HTMLButtonElement>(null);

  function resize(height: number) {
    const maximum = formRef.current!.parentElement!.clientHeight * 0.8;
    setComposerHeight(Math.max(88, Math.min(maximum, height)));
  }

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    drag.current = {
      y: event.clientY,
      height: formRef.current!.getBoundingClientRect().height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveResize(event: React.PointerEvent<HTMLDivElement>) {
    if (drag.current) {
      resize(drag.current.height + drag.current.y - event.clientY);
    }
  }

  function resizeWithKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    const height = formRef.current!.getBoundingClientRect().height;
    switch (event.key) {
      case 'ArrowUp':
        resize(height + 32);
        break;
      case 'ArrowDown':
        resize(height - 32);
        break;
      case 'Home':
        resize(88);
        break;
      case 'End':
        resize(Infinity);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

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

    if (sending || disabled) {
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
      setComposerHeight(null);
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
      ref={formRef}
      id="message-reply"
      name="messageForm"
      className={`form-horizontal${
        composerHeight === null ? '' : ' message-reply-resized'
      }`}
      style={{ height: composerHeight ?? undefined }}
      onSubmit={event => send(event)}
    >
      {/* A focusable separator is the ARIA window-splitter pattern; the
          keyboard handler below changes its announced value. */}
      {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      <div
        className="message-reply-resize-handle"
        role="separator"
        tabIndex={0}
        aria-orientation="horizontal"
        aria-label={t<string>('Resize message editor')}
        aria-controls="message-reply-writing-area"
        aria-keyshortcuts="ArrowUp ArrowDown Home End"
        aria-valuemin={88}
        aria-valuemax={
          composerHeight === null
            ? undefined
            : Math.max(88, formRef.current!.parentElement!.clientHeight * 0.8)
        }
        aria-valuenow={composerHeight ?? undefined}
        onPointerDown={startResize}
        onPointerMove={moveResize}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        onKeyDown={resizeWithKeyboard}
      />
      {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      <div
        id="message-reply-writing-area"
        className="row message-reply-editor-row"
      >
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
                      <RichText
                        className="panel-body"
                        content={previewContent}
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
            'Highlight text to change its appearance. Ctrl+Enter to send.',
          )}
        </small>
        <button
          id="messageReplySubmit"
          className="btn btn-md btn-primary message-reply-btn"
          type="submit"
          disabled={sending || disabled}
        >
          <i className="icon-send" />
          <span className="hidden-xs">&nbsp;{t<string>('Send')}</span>
        </button>
      </div>
    </form>
  );
}
