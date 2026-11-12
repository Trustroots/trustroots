import React, { useEffect, useState } from 'react';
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
  FEATURED_NOTE_PUBLISH_RELAY,
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
  signNostrTextNote,
} from '../api/featured-nostr-notes.api';
import AdminHeader from './AdminHeader.component';

type PendingDeletion = { note: FeaturedNostrNote; event?: Event };
type PendingPublication = { event: Event; acknowledged: boolean };

export default function AdminNostr() {
  const [notes, setNotes] = useState<FeaturedNostrNote[] | null>(null);
  const [reference, setReference] = useState('');
  const [draft, setDraft] = useState('');
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

  function addFeaturedNote(note: FeaturedNostrNote) {
    if (!featuredNotes.some(entry => entry.id === note.id)) {
      setNotes([note, ...featuredNotes]);
    }
  }

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setStatus('');
    let acknowledged = publication?.acknowledged ?? false;
    try {
      const signed = publication?.event ?? (await signNostrTextNote(draft));
      if (!acknowledged) {
        setPublication({ event: signed, acknowledged: false });
        await publishNostrTextNote(signed);
        acknowledged = true;
        setPublication({ event: signed, acknowledged });
      }
      addFeaturedNote(await featureSignedNostrNote(signed));
      setPublication(null);
      setDraft('');
      setStatus(
        `Note published to ${FEATURED_NOTE_PUBLISH_RELAY} and featured on the homepage.`,
      );
    } catch (cause) {
      const message = getErrorMessage(
        cause,
        cause instanceof Error ? cause.message : 'Could not publish the note.',
      );
      setError(
        acknowledged
          ? `Published to ${FEATURED_NOTE_PUBLISH_RELAY}. Could not save to the homepage. ${message}`
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
      addFeaturedNote(await featureNostrNote(reference));
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
      <div className="container">
        <h1>Featured Nostr notes</h1>
        <h2>Publish a note</h2>
        <p>
          Your NIP-07 browser signer will sign the note. Trustroots will publish
          it to {FEATURED_NOTE_PUBLISH_RELAY} and feature it on the homepage.
        </p>
        <form onSubmit={publish}>
          <div className="form-group">
            <label htmlFor="nostr-note-text">Note text</label>
            <textarea
              id="nostr-note-text"
              className="form-control"
              rows={4}
              value={draft}
              onChange={event => {
                setDraft(event.target.value);
                setPublication(null);
              }}
              required
              disabled={busy}
              readOnly={publication?.acknowledged}
              aria-describedby="nostr-note-markdown"
            />
            <p id="nostr-note-markdown" className="help-block">
              Add a link with Markdown, for example{' '}
              <code>
                [Get involved](https://www.trustroots.org/volunteering)
              </code>
              .
            </p>
          </div>
          <Button type="submit" disabled={busy || !notes || !draft.trim()}>
            {publication?.acknowledged
              ? 'Retry homepage save'
              : 'Publish and feature note'}
          </Button>
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
            <Button disabled={busy} onClick={() => void remove(note.id)}>
              Remove from homepage
            </Button>{' '}
            <Button
              disabled={busy}
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
