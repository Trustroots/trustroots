import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import '@/config/client/i18n';
import http from '@/modules/core/client/api/http-client';
import HomeFeaturedNostrNotes from '@/modules/pages/client/components/HomeFeaturedNostrNotes.component';

afterEach(() => jest.restoreAllMocks());

it('links safe Markdown and displays the author username as plain text', async () => {
  const note = {
    id: 'cd'.repeat(32),
    content: [
      '<b>Fictional announcement</b>',
      '[Details](https://example.test/details)',
      '[Get involved]\\(https\\://example\\.test/volunteering)',
      '[Unsupported](javascript:ignored)',
      '[Invalid](https://%)',
      '![Image](https://example.test/image)',
    ].join('\n'),
    npub: 'npub1example',
    authorUsername: 'fictionalauthor',
    publishedAt: '2026-11-01T12:00:00.000Z',
  };
  const get = jest.spyOn(http, 'get').mockResolvedValue({ data: [note] });
  const { container, unmount } = render(<HomeFeaturedNostrNotes />);
  expect(
    await screen.findByRole('heading', { name: 'Trustroots updates' }),
  ).toBeVisible();
  expect(screen.getByRole('article')).toHaveTextContent(
    '<b>Fictional announcement</b>',
  );
  expect(container.querySelector('article b')).toBeNull();
  expect(screen.getByRole('article')).toHaveTextContent(
    'fictionalauthor · 2026-11-01',
  );
  expect(screen.getByRole('article')).not.toHaveTextContent(note.npub);
  expect(screen.getByText('2026-11-01')).toHaveAttribute(
    'datetime',
    note.publishedAt,
  );
  expect(screen.getByRole('link', { name: 'Details' })).toHaveAttribute(
    'href',
    'https://example.test/details',
  );
  expect(screen.getByRole('link', { name: 'Get involved' })).toHaveAttribute(
    'href',
    'https://example.test/volunteering',
  );
  expect(screen.getByRole('article')).toHaveTextContent(
    '[Unsupported](javascript:ignored)',
  );
  expect(screen.getAllByRole('link')).toHaveLength(2);
  expect(get).toHaveBeenCalledWith('/api/nostr/featured-notes', {
    signal: expect.any(AbortSignal),
  });
  unmount();
  expect(get.mock.calls[0][1]?.signal?.aborted).toBe(true);
});

it('shows only the date when the author has no public username', async () => {
  const note = {
    id: 'ab'.repeat(32),
    content: 'An update from an unlinked author.',
    npub: 'npub1unlinked',
    publishedAt: '2026-11-01T12:00:00.000Z',
  };
  jest.spyOn(http, 'get').mockResolvedValue({ data: [note] });
  render(<HomeFeaturedNostrNotes />);

  expect(await screen.findByRole('article')).toHaveTextContent(
    /An update from an unlinked author\.\s*2026-11-01$/,
  );
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it('omits the section if the notes cannot be loaded', async () => {
  jest.spyOn(http, 'get').mockRejectedValue(new Error('Offline'));
  const { container } = render(<HomeFeaturedNostrNotes />);
  await act(async () => {});
  expect(container).toBeEmptyDOMElement();
});
