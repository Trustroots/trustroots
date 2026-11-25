import type { Event } from 'nostr-tools';
import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import AdminNostr from '@/modules/admin/client/components/AdminNostr.component';
import {
  featureNostrNote,
  featureSignedNostrNote,
  publishNostrNoteDeletion,
  publishNostrTextNote,
  recordNostrNoteDeletion,
  removeFeaturedNostrNote,
  reviseFeaturedNostrNote,
  signNostrTextNote,
} from '@/modules/admin/client/api/featured-nostr-notes.api';
import { listFeaturedNostrNotes } from '@/modules/core/client/api/featured-nostr-notes.api';
import http from '@trustroots/core/http-client';

vi.mock('@/modules/admin/client/components/AdminHeader.component', () => ({
  default: () => null,
}));
vi.mock('@/modules/admin/client/api/featured-nostr-notes.api');
vi.mock('@/modules/core/client/api/featured-nostr-notes.api');

const listNotes = vi.mocked(listFeaturedNostrNotes);
const featureNote = vi.mocked(featureNostrNote);
const removeNote = vi.mocked(removeFeaturedNostrNote);
const note = {
  id: 'ab'.repeat(32),
  content: 'A fictional update.',
  npub: 'npub1example',
  publishedAt: '2026-11-01T12:00:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

it('publishes the service profile and lets an administrator retry a relay failure', async () => {
  listNotes.mockResolvedValue([]);
  const post = vi.spyOn(http, 'post');
  post
    .mockRejectedValueOnce({
      response: { data: { message: 'Relay unavailable.' } },
    })
    .mockResolvedValueOnce({ data: {} });
  render(<AdminNostr />);
  await screen.findByText('No featured notes.');

  const profile = within(
    screen.getByRole('region', { name: 'Trustroots service identity' }),
  );
  const publish = profile.getByRole('button', {
    name: 'Publish Trustroots profile',
  });
  fireEvent.click(publish);
  expect(publish).toBeDisabled();
  expect(await profile.findByRole('alert')).toHaveTextContent(
    'Relay unavailable.',
  );
  expect(publish).toBeEnabled();

  fireEvent.click(publish);
  expect(profile.queryByRole('alert')).toBeNull();
  expect(await profile.findByRole('status')).toHaveTextContent(
    'Trustroots profile published.',
  );
  expect(publish).toBeEnabled();
  expect(post.mock.calls).toEqual([
    ['/api/admin/nostr/service-profile'],
    ['/api/admin/nostr/service-profile'],
  ]);
});

it('inserts a web link into selected text and retries a revision without publishing twice', async () => {
  const content = 'A [fictional](https://example.test/details) update.';
  const signed = { id: 'bc'.repeat(32), kind: 30023 } as Event;
  const other = {
    ...note,
    id: 'cd'.repeat(32),
    content: 'Another fictional note.',
  };
  listNotes.mockResolvedValue([note, other]);
  vi.mocked(signNostrTextNote).mockResolvedValue(signed);
  vi.mocked(publishNostrTextNote).mockResolvedValue([
    'wss://relay.nomadwiki.org',
  ]);
  const revise = vi.mocked(reviseFeaturedNostrNote);
  revise
    .mockRejectedValueOnce(new Error('Service unavailable.'))
    .mockResolvedValue({ ...note, content });
  render(<AdminNostr />);
  const input = screen.getByRole<HTMLTextAreaElement>('textbox', {
    name: 'Note text',
  });
  fireEvent.change(input, { target: { value: 'Unpublished draft.' } });
  fireEvent.click(
    within((await screen.findAllByRole('article'))[0]).getByRole('button', {
      name: 'Edit note',
    }),
  );
  expect(input).toHaveValue(note.content);
  input.setSelectionRange(2, 11);
  fireEvent.click(screen.getByRole('button', { name: 'Insert link' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Insert link' }));
  expect(dialog.getByLabelText('Link text')).toHaveValue('fictional');
  const url = dialog.getByLabelText('Web address');
  const insert = dialog.getByRole('button', { name: 'Insert' });
  fireEvent.change(url, { target: { value: 'javascript:ignored' } });
  expect(insert).toBeDisabled();
  fireEvent.submit(insert.closest('form')!);
  expect(input).toHaveValue(note.content);
  fireEvent.change(url, { target: { value: 'https://' } });
  expect(insert).toBeDisabled();
  fireEvent.change(url, { target: { value: 'https://example.test/details' } });
  fireEvent.click(insert);
  expect(input).toHaveValue(content);
  fireEvent.click(screen.getByRole('button', { name: 'Publish revision' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Service unavailable.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Retry homepage save' }));
  expect(
    await screen.findByRole('link', { name: 'fictional' }),
  ).toHaveAttribute('href', 'https://example.test/details');
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(screen.getAllByRole('article')[1]).toHaveTextContent(other.content);
  expect(input).toHaveValue('Unpublished draft.');
  expect(signNostrTextNote).toHaveBeenCalledWith(content, note);
  expect(publishNostrTextNote).toHaveBeenCalledTimes(1);
  expect(revise.mock.calls).toEqual([
    [note.id, signed],
    [note.id, signed],
  ]);
});

it('discards link fields when the link dialog is dismissed without replacing the draft', async () => {
  listNotes.mockResolvedValue([]);
  render(<AdminNostr />);
  await screen.findByText('No featured notes.');
  const draft = screen.getByRole('textbox', { name: 'Note text' });
  fireEvent.change(draft, { target: { value: 'One fictional line.' } });
  const open = screen.getByRole('button', { name: 'Insert link' });
  fireEvent.click(open);
  let dialog = within(screen.getByRole('dialog', { name: 'Insert link' }));
  expect(dialog.getByLabelText('Link text')).toHaveValue('');
  fireEvent.change(dialog.getByLabelText('Link text'), {
    target: { value: 'A [broken] label' },
  });
  fireEvent.change(dialog.getByLabelText('Web address'), {
    target: { value: 'https://example.test' },
  });
  expect(dialog.getByRole('button', { name: 'Insert' })).toBeDisabled();
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(open);
  dialog = within(screen.getByRole('dialog', { name: 'Insert link' }));
  expect(dialog.getByLabelText('Link text')).toHaveValue('');
  fireEvent.keyDown(dialog.getByLabelText('Link text'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(draft).toHaveValue('One fictional line.');
});

it('keeps the draft and retries each failed step with the same signed event', async () => {
  const signed = { id: note.id, kind: 1 } as Event;
  const sign = vi.mocked(signNostrTextNote);
  const publish = vi.mocked(publishNostrTextNote);
  const save = vi.mocked(featureSignedNostrNote);
  listNotes.mockResolvedValue([]);
  sign
    .mockRejectedValueOnce(new Error('Signing cancelled.'))
    .mockResolvedValue(signed);
  publish
    .mockRejectedValueOnce(undefined)
    .mockResolvedValue(['wss://relay.nomadwiki.org']);
  save
    .mockRejectedValueOnce(new Error('Service unavailable.'))
    .mockResolvedValue(note);
  render(<AdminNostr />);
  await screen.findByText('No featured notes.');

  const input = screen.getByRole('textbox', { name: 'Note text' });
  const submit = screen.getByRole('button', {
    name: 'Publish and feature note',
  });
  expect(submit).toBeDisabled();
  fireEvent.change(input, { target: { value: note.content } });

  fireEvent.click(submit);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Signing cancelled.',
  );
  expect(publish).not.toHaveBeenCalled();

  fireEvent.click(submit);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not publish the note.',
  );
  expect(save).not.toHaveBeenCalled();
  expect(input).toHaveValue(note.content);

  fireEvent.click(submit);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Published to wss://relay.nomadwiki.org. Could not save to the homepage. Service unavailable.',
  );
  expect(input).toHaveAttribute('readonly');
  fireEvent.click(screen.getByRole('button', { name: 'Retry homepage save' }));

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Note published to wss://relay.nomadwiki.org and featured on the homepage.',
  );
  expect(input).toHaveValue('');
  expect(screen.getByRole('article')).toHaveTextContent(note.content);
  expect(sign).toHaveBeenCalledTimes(2);
  expect(sign).toHaveBeenLastCalledWith(note.content);
  expect(publish.mock.calls).toEqual([[signed], [signed]]);
  expect(save.mock.calls).toEqual([[signed], [signed]]);
});

it('features a note once and removes it from the list', async () => {
  listNotes.mockResolvedValue([]);
  featureNote.mockResolvedValue(note);
  removeNote.mockResolvedValue(undefined);
  render(<AdminNostr />);
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading featured notes',
  );
  expect(await screen.findByText('No featured notes.')).toBeVisible();

  const submit = screen.getByRole('button', { name: 'Feature note' });
  expect(submit).toBeDisabled();
  for (let index = 0; index < 2; index += 1) {
    fireEvent.change(screen.getByLabelText('Nostr note link or event ID'), {
      target: { value: note.id },
    });
    fireEvent.click(submit);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Updating featured notes',
    );
    await screen.findByText('Note featured on the homepage.');
  }
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(featureNote).toHaveBeenLastCalledWith(note.id);
  fireEvent.click(screen.getByRole('button', { name: 'Remove from homepage' }));
  expect(
    await screen.findByText('Note removed from the homepage.'),
  ).toBeVisible();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(removeNote).toHaveBeenCalledWith(note.id);
});

it('reports lookup and removal failures', async () => {
  listNotes.mockResolvedValue([note]);
  featureNote
    .mockRejectedValueOnce(new Error('Relay unavailable.'))
    .mockRejectedValueOnce(undefined);
  removeNote.mockRejectedValue({
    response: { data: { message: 'Removal failed.' } },
  });
  render(<AdminNostr />);
  await screen.findByText(note.content);
  for (const message of ['Relay unavailable.', 'Could not feature the note.']) {
    fireEvent.change(screen.getByLabelText('Nostr note link or event ID'), {
      target: { value: 'unavailable' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Feature note' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Remove from homepage' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Removal failed.');
  expect(screen.getByText(note.content)).toBeVisible();
});

it('reports a load failure', async () => {
  listNotes.mockRejectedValue(new Error('Offline'));
  render(<AdminNostr />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load featured notes.',
  );
});

it('aborts the list request when leaving the page', async () => {
  let reject!: (cause: Error) => void;
  listNotes.mockReturnValue(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  const view = render(<AdminNostr />);
  view.unmount();
  await act(async () => reject(new Error('Cancelled')));
  expect(listNotes.mock.calls[0][0]?.aborted).toBe(true);
});

it('confirms a Nostr deletion and retries the local save without publishing twice', async () => {
  const signed = { id: 'cd'.repeat(32), kind: 5 } as Event;
  const publish = vi.mocked(publishNostrNoteDeletion);
  const record = vi.mocked(recordNostrNoteDeletion);
  listNotes.mockResolvedValue([note]);
  publish
    .mockRejectedValueOnce(new Error('Relay unavailable.'))
    .mockResolvedValueOnce(signed);
  record.mockRejectedValueOnce(undefined).mockResolvedValueOnce(undefined);
  render(<AdminNostr />);
  const trigger = await screen.findByRole('button', {
    name: 'Request Nostr deletion',
  });
  fireEvent.click(trigger);
  let dialog = screen.getByRole('dialog', { name: 'Request Nostr deletion?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(publish).not.toHaveBeenCalled();

  fireEvent.click(trigger);
  dialog = screen.getByRole('dialog', { name: 'Request Nostr deletion?' });
  const confirm = within(dialog).getByRole('button', {
    name: 'Sign and request deletion',
  });
  fireEvent.click(confirm);
  expect(
    within(dialog).getByRole('button', { name: 'Submitting…' }),
  ).toBeDisabled();
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Relay unavailable.',
  );
  expect(record).not.toHaveBeenCalled();

  fireEvent.click(confirm);
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Could not complete the deletion request.',
  );
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Retry homepage removal' }),
  );
  expect(
    await screen.findByText(
      'Deletion request published and note removed from the homepage.',
    ),
  ).toBeVisible();
  expect(publish).toHaveBeenCalledTimes(2);
  expect(record).toHaveBeenCalledTimes(2);
  expect(record).toHaveBeenLastCalledWith(note.id, signed);
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});
