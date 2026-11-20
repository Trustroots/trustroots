import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@trustroots/ui/Button';
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
} from '@trustroots/ui/Modal';
import type { Event } from 'nostr-tools';
import { listFeaturedNostrNotes } from '@/modules/core/client/api/featured-nostr-notes.api';
import { getErrorMessage } from '@/modules/core/client/api/http-client';
import FeaturedNostrNoteContent from '@/modules/core/client/components/FeaturedNostrNote.component';
import {
  FEATURED_NOTE_PUBLISH_RELAYS,
  FEATURED_NOTE_RELAYS,
  type FeaturedNostrNote,
} from '@/modules/core/shared/featured-nostr-notes.mts';
import {
  featureNostrNote,
  featureSignedNostrNote,
  publishNostrNoteDeletion,
  publishNostrTextNote,
  recordNostrNoteDeletion,
  removeFeaturedNostrNote,
  reviseFeaturedNostrNote,
  signNostrTextNote,
} from '../api/featured-nostr-notes.api';
import AdminHeader from './AdminHeader.component';

type PendingDeletion = { note: FeaturedNostrNote; event?: Event };
type PendingPublication = { event: Event; acknowledgedRelays?: string[] };
type LinkDraft = { start: number; end: number; text: string; url: string };

function markdownLink({ text, url }: LinkDraft) {
  const label = text.trim();
  if (!label || /[[\]\r\n]/.test(label) || !/^https?:\/\//i.test(url.trim()))
    return;
  try {
    const destination = new URL(url).href
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29');
    return `[${label}](${destination})`;
  } catch {
    return undefined;
  }
}

export default function AdminNostr() {
  const [notes, setNotes] = useState<FeaturedNostrNote[] | null>(null);
  const [reference, setReference] = useState('');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<FeaturedNostrNote | null>(null);
  const [link, setLink] = useState<LinkDraft | null>(null);
  const noteText = useRef<HTMLTextAreaElement>(null);
  const linkText = useRef<HTMLInputElement>(null);
  const linkUrl = useRef<HTMLInputElement>(null);
  const previousDraft = useRef('');
  const [publication, setPublication] = useState<PendingPublication | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [deletion, setDeletion] = useState<PendingDeletion | null>(null);
  const featuredNotes = notes ?? [];

  useEffect(() => {
    const controller = new AbortController();
    listFeaturedNostrNotes(controller.signal).then(setNotes, () => {
      if (!controller.signal.aborted)
        setError('Could not load featured notes.');
    });
    return () => controller.abort();
  }, []);

  function recordFeaturedNote(note: FeaturedNostrNote) {
    const next = [...featuredNotes];
    const index = next.findIndex(entry => entry.id === note.id);
    if (index === -1) next.unshift(note);
    else next[index] = note;
    setNotes(next);
  }

  function changeDraft(value: string) {
    setDraft(value);
    setPublication(null);
  }

  function startEditing(note: FeaturedNostrNote) {
    previousDraft.current = draft;
    setEditing(note);
    changeDraft(note.content);
    setError('');
    setStatus('');
    noteText.current?.focus();
  }

  function closeEdit() {
    setEditing(null);
    changeDraft(previousDraft.current);
    setError('');
  }

  function openLinkEditor() {
    const textarea = noteText.current!;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setLink({ start, end, text: draft.slice(start, end), url: '' });
  }

  function insertLink(
    event: React.FormEvent<HTMLFormElement>,
    link: LinkDraft,
  ) {
    event.preventDefault();
    const markdown = markdownLink(link);
    if (!markdown) return;
    changeDraft(draft.slice(0, link.start) + markdown + draft.slice(link.end));
    setLink(null);
    requestAnimationFrame(() => {
      noteText.current?.focus();
      noteText.current?.setSelectionRange(
        link.start + markdown.length,
        link.start + markdown.length,
      );
    });
  }

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setStatus('');
    let acknowledgedRelays = publication?.acknowledgedRelays;
    try {
      const signed = await (publication?.event ??
        (editing
          ? signNostrTextNote(draft, editing)
          : signNostrTextNote(draft)));
      if (!acknowledgedRelays) {
        setPublication({ event: signed });
        acknowledgedRelays = await publishNostrTextNote(signed);
        setPublication({ event: signed, acknowledgedRelays });
      }
      if (editing) {
        recordFeaturedNote(await reviseFeaturedNostrNote(editing.id, signed));
        closeEdit();
      } else {
        recordFeaturedNote(await featureSignedNostrNote(signed));
        setDraft('');
      }
      setPublication(null);
      setStatus(
        editing
          ? `Revision published to ${acknowledgedRelays.join(', ')} and updated on the homepage.`
          : `Note published to ${acknowledgedRelays.join(', ')} and featured on the homepage.`,
      );
    } catch (cause) {
      const message = getErrorMessage(
        cause,
        cause instanceof Error ? cause.message : 'Could not publish the note.',
      );
      setError(
        acknowledgedRelays
          ? `Published to ${acknowledgedRelays.join(', ')}. Could not save to the homepage. ${message}`
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function feature(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setStatus('');
    try {
      recordFeaturedNote(await featureNostrNote(reference));
      setReference('');
      setStatus('Note featured on the homepage.');
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
          cause instanceof Error
            ? cause.message
            : 'Could not feature the note.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await removeFeaturedNostrNote(id);
      setNotes(featuredNotes.filter(note => note.id !== id));
      setStatus('Note removed from the homepage.');
    } catch (cause) {
      setError(getErrorMessage(cause, 'Could not remove the note.'));
    } finally {
      setBusy(false);
    }
  }

  async function requestDeletion({ note, event }: PendingDeletion) {
    setBusy(true);
    setError('');
    try {
      const signed = event ?? (await publishNostrNoteDeletion(note));
      setDeletion({ note, event: signed });
      await recordNostrNoteDeletion(note.id, signed);
      setNotes(featuredNotes.filter(entry => entry.id !== note.id));
      setDeletion(null);
      setStatus(
        'Deletion request published and note removed from the homepage.',
      );
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
          cause instanceof Error
            ? cause.message
            : 'Could not complete the deletion request.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  function closeDeletion() {
    setDeletion(null);
    setError('');
  }

  return (
    <>
      <AdminHeader />
      <div className="tw:page-container">
        <h1>Featured Nostr notes</h1>
        <h2>{editing ? 'Edit featured note' : 'Publish a note'}</h2>
        <p>
          Your NIP-07 browser signer will sign the note. Trustroots will publish
          it to {FEATURED_NOTE_PUBLISH_RELAYS.join(', ')} and feature it on the
          homepage.
        </p>
        {editing && !editing.article && (
          <p>
            This edit will publish an editable version and update the homepage.
            The original short note remains on Nostr.
          </p>
        )}
        <form onSubmit={publish}>
          <div className="form-group">
            <label htmlFor="nostr-note-text">Note text</label>
            <textarea
              ref={noteText}
              id="nostr-note-text"
              className="form-control"
              rows={4}
              value={draft}
              onChange={event => changeDraft(event.target.value)}
              required
              disabled={busy}
              readOnly={Boolean(publication?.acknowledgedRelays)}
            />
            <Button
              type="button"
              onClick={openLinkEditor}
              disabled={busy || Boolean(publication?.acknowledgedRelays)}
            >
              Insert link
            </Button>
          </div>
          <Button type="submit" disabled={busy || !notes || !draft.trim()}>
            {publication?.acknowledgedRelays
              ? 'Retry homepage save'
              : editing
                ? 'Publish revision'
                : 'Publish and feature note'}
          </Button>
          {editing && (
            <Button type="button" disabled={busy} onClick={closeEdit}>
              {publication?.acknowledgedRelays ? 'Close editor' : 'Cancel edit'}
            </Button>
          )}
        </form>
        <h2>Feature an existing note</h2>
        <form onSubmit={feature}>
          <div className="form-group">
            <label htmlFor="featured-note-reference">
              Nostr note link or event ID
            </label>
            <input
              id="featured-note-reference"
              className="form-control"
              value={reference}
              onChange={event => setReference(event.target.value)}
              required
              maxLength={2048}
              disabled={busy}
            />
          </div>
          <Button type="submit" disabled={busy || !notes || !reference.trim()}>
            Feature note
          </Button>
        </form>
        {!deletion && error && <p role="alert">{error}</p>}
        {!deletion && (busy || status || (!notes && !error)) && (
          <p role="status">
            {busy
              ? 'Updating featured notes…'
              : status || 'Loading featured notes…'}
          </p>
        )}
        <h2>On the homepage</h2>
        {notes?.length === 0 && <p>No featured notes.</p>}
        {featuredNotes.map(note => (
          <article key={note.id} className="well">
            <FeaturedNostrNoteContent note={note} />
            <Button
              disabled={busy || Boolean(editing || publication)}
              onClick={() => startEditing(note)}
            >
              Edit note
            </Button>{' '}
            <Button
              disabled={busy || editing?.id === note.id}
              onClick={() => void remove(note.id)}
            >
              Remove from homepage
            </Button>{' '}
            <Button
              disabled={busy || editing?.id === note.id}
              onClick={() => {
                setError('');
                setStatus('');
                setDeletion({ note });
              }}
            >
              Request Nostr deletion
            </Button>
          </article>
        ))}
      </div>
      {link && (
        <Modal
          open
          onClose={() => setLink(null)}
          initialFocus={link.start === link.end ? linkText : linkUrl}
        >
          <ModalHeader>
            <ModalTitle>Insert link</ModalTitle>
          </ModalHeader>
          <form onSubmit={event => insertLink(event, link)}>
            <ModalBody>
              <div className="form-group">
                <label htmlFor="nostr-link-text">Link text</label>
                <input
                  id="nostr-link-text"
                  ref={linkText}
                  className="form-control"
                  required
                  value={link.text}
                  onChange={event =>
                    setLink({ ...link, text: event.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="nostr-link-url">Web address</label>
                <input
                  id="nostr-link-url"
                  ref={linkUrl}
                  className="form-control"
                  type="url"
                  placeholder="https://example.org"
                  required
                  value={link.url}
                  onChange={event =>
                    setLink({ ...link, url: event.target.value })
                  }
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button type="button" onClick={() => setLink(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!markdownLink(link)}>
                Insert
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
      {deletion && (
        <Modal open onClose={closeDeletion} dismissible={!busy}>
          <ModalHeader>
            <ModalTitle>Request Nostr deletion?</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p>
              Sign a deletion request with the key that published this note.
              Trustroots will send it to {FEATURED_NOTE_RELAYS.join(', ')}.
              Trustroots will remove its copy once a relay accepts the request.
              Other relays and clients may retain copies.
            </p>
            {deletion.event && (
              <p>
                The request was published. Retry to remove the homepage copy.
              </p>
            )}
            {error && <p role="alert">{error}</p>}
          </ModalBody>
          <ModalFooter>
            <Button disabled={busy} onClick={closeDeletion}>
              Cancel
            </Button>
            <Button
              intent="danger"
              disabled={busy}
              onClick={() => void requestDeletion(deletion)}
            >
              {busy
                ? 'Submitting…'
                : deletion.event
                  ? 'Retry homepage removal'
                  : 'Sign and request deletion'}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
