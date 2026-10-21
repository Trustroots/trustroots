import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import TrEditor from '@/modules/core/client/components/TrEditor';
import { plainTextLength } from '@/modules/core/client/utils/filters';
import {
  previewMessage,
  type HostingContext,
  type HostingDetails,
} from '../api/messages.api';
import RichText from '@/modules/core/client/components/RichText';
import MessageBubble from './MessageBubble';

type ThreadReplyProps = {
  onSend: (
    content: string,
    hostingDetails?: HostingDetails,
    hostingDescriptionAcknowledged?: boolean,
  ) => Promise<unknown>;
  cacheKey?: string;
  autoFocus?: boolean;
  hostingContext?: HostingContext | null;
  hostingContextLoading?: boolean;
  hostingContextError?: boolean;
  onHostingModeChange?: (enabled: boolean) => void;
  onRetryHostingContext?: () => void;
};

export default function ThreadReply({
  onSend,
  cacheKey,
  autoFocus = false,
  hostingContext = null,
  hostingContextLoading = false,
  hostingContextError = false,
  onHostingModeChange = () => {},
  onRetryHostingContext = () => {},
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
  const [hostingMode, setHostingMode] = useState(false);
  const [guests, setGuests] = useState(1);
  const [arrival, setArrival] = useState('');
  const [departure, setDeparture] = useState('');
  const [hostingDescriptionAcknowledged, setHostingDescriptionAcknowledged] =
    useState(false);

  function toggleHostingMode(enabled: boolean) {
    setHostingMode(enabled);
    setHostingDescriptionAcknowledged(false);
    onHostingModeChange(enabled);
  }

  function validCalendarDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1) return false;
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  const datesValid =
    (!arrival && !departure) ||
    (validCalendarDate(arrival) &&
      validCalendarDate(departure) &&
      departure > arrival);
  const guestsValid = Number.isInteger(guests) && guests >= 1 && guests <= 100;
  const hostingDisabled =
    hostingMode &&
    (hostingContextLoading ||
      hostingContextError ||
      !hostingContext ||
      !guestsValid ||
      !datesValid ||
      (hostingContext.acknowledgementRequired &&
        !hostingDescriptionAcknowledged));

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

  useEffect(() => {
    setHostingDescriptionAcknowledged(false);
  }, [hostingContext]);

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

    if (sending || hostingDisabled) {
      return;
    }

    if (plainTextLength(content) === 0) {
      return;
    }

    setSending(true);
    const hostingDetails = hostingMode
      ? {
          guests,
          ...(arrival ? { arrival } : {}),
          ...(departure ? { departure } : {}),
        }
      : undefined;
    const sent = hostingMode
      ? await onSend(
          content,
          hostingDetails,
          hostingContext?.acknowledgementRequired
            ? hostingDescriptionAcknowledged
            : undefined,
        )
      : await onSend(content);

    // Clear only when really sent to avoid data loss
    if (sent) {
      previewRequest.current += 1;
      setPreviewing(false);
      setComposerHeight(null);
      setContent('');
      setGuests(1);
      setArrival('');
      setDeparture('');
      setHostingDescriptionAcknowledged(false);
      if (hostingMode) toggleHostingMode(false);
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
      }${hostingMode ? ' message-reply-hosting' : ''}`}
      style={{ height: composerHeight ?? undefined }}
      onSubmit={event => send(event)}
    >
      <div className="hosting-message-options">
        <label>
          <input
            type="checkbox"
            checked={hostingMode}
            onChange={event => toggleHostingMode(event.target.checked)}
          />{' '}
          {t<string>('Add hosting details')}
        </label>
        {hostingMode && (
          <div className="hosting-message-details">
            {hostingContextLoading && (
              <p role="status">{t<string>('Loading hosting details…')}</p>
            )}
            {hostingContextError && (
              <div role="alert">
                <p>{t<string>('Could not load the hosting information.')}</p>
                <button
                  type="button"
                  className="btn btn-default btn-sm"
                  onClick={onRetryHostingContext}
                >
                  {t<string>('Retry')}
                </button>
              </div>
            )}
            {hostingContext && !hostingContextLoading && (
              <>
                <p className="text-muted">
                  {t<string>(
                    'Please read the host’s description and discuss the visit together.',
                  )}
                </p>
                {(hostingContext.description ||
                  hostingContext.acknowledgementRequired) && (
                  <section
                    className="hosting-description-acknowledgement"
                    aria-label={t<string>(
                      'Hosting description and requirements',
                    )}
                  >
                    <h4>{t<string>('Hosting description and requirements')}</h4>
                    <RichText content={hostingContext.description} />
                    {hostingContext.acknowledgementRequired && (
                      <label>
                        <input
                          type="checkbox"
                          required
                          checked={hostingDescriptionAcknowledged}
                          onChange={event =>
                            setHostingDescriptionAcknowledged(
                              event.target.checked,
                            )
                          }
                        />{' '}
                        {t<string>(
                          'I have read this host’s hosting description and requirements.',
                        )}
                      </label>
                    )}
                  </section>
                )}
              </>
            )}
            <div className="hosting-visit-fields">
              <label>
                {t<string>('Guests')}
                <input
                  className="form-control"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={guests}
                  onChange={event => setGuests(Number(event.target.value))}
                />
              </label>
              <label>
                {t<string>('Arrival (optional)')}
                <input
                  className="form-control"
                  type="date"
                  value={arrival}
                  onChange={event => setArrival(event.target.value)}
                />
              </label>
              <label>
                {t<string>('Departure (optional)')}
                <input
                  className="form-control"
                  type="date"
                  value={departure}
                  onChange={event => setDeparture(event.target.value)}
                />
              </label>
            </div>
          </div>
        )}
      </div>
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
          disabled={sending || hostingDisabled}
        >
          <i className="icon-send" />
          <span className="hidden-xs">&nbsp;{t<string>('Send')}</span>
        </button>
      </div>
    </form>
  );
}
