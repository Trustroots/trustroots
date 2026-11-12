import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import '@/config/client/i18n';
import http from '@/modules/core/client/api/http-client';
import HomeFeaturedNostrNotes from '@/modules/pages/client/components/HomeFeaturedNostrNotes.component';

afterEach(() => jest.restoreAllMocks());

it('shows public note text, attribution and a link to the original', async () => {
  const note = {
    id: 'cd'.repeat(32),
    content: '<b>Fictional announcement</b>\nSecond line.',
    npub: 'npub1example',
    publishedAt: '2026-11-01T12:00:00.000Z',
  };
  const get = jest.spyOn(http, 'get').mockResolvedValue({ data: [note] });
  const { container, unmount } = render(<HomeFeaturedNostrNotes />);
  expect(
    await screen.findByRole('heading', { name: 'Updates from Nostr' }),
  ).toBeVisible();
  expect(screen.getByRole('article')).toHaveTextContent(
    '<b>Fictional announcement</b>',
  );
  expect(container.querySelector('article b')).toBeNull();
  expect(screen.getByRole('article')).toHaveTextContent(note.npub);
  expect(screen.getByText('2026-11-01')).toHaveAttribute(
    'datetime',
    note.publishedAt,
  );
  expect(screen.getByRole('link', { name: 'View on Nostr' })).toHaveAttribute(
    'href',
    expect.stringMatching(/^https:\/\/njump\.me\/note1/),
  );
  expect(get).toHaveBeenCalledWith('/api/nostr/featured-notes', {
    signal: expect.any(AbortSignal),
  });
  unmount();
  expect(get.mock.calls[0][1]?.signal?.aborted).toBe(true);
});

it('omits the section if the notes cannot be loaded', async () => {
  jest.spyOn(http, 'get').mockRejectedValue(new Error('Offline'));
  const { container } = render(<HomeFeaturedNostrNotes />);
  await act(async () => {});
  expect(container).toBeEmptyDOMElement();
});
