import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from '@/modules/core/client/api/http-client';
import AdminEmailReplies from '@/modules/admin/client/components/AdminEmailReplies.component';

jest.mock('@/modules/core/client/api/http-client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock('@/modules/admin/client/components/AdminHeader.component', () => ({
  __esModule: true,
  default: () => null,
}));

const get = jest.mocked(axios.get);
const checkedAt = '2026-10-31T12:00:00Z';

function checkMailbox() {
  fireEvent.click(screen.getByRole('button', { name: 'Check mailbox' }));
}

beforeEach(() => {
  get.mockReset();
});

it('checks the mailbox on demand and distinguishes missing configuration, failure and no mail', async () => {
  get
    .mockResolvedValueOnce({ data: { status: 'unconfigured' } })
    .mockRejectedValueOnce(new Error('provider unavailable'))
    .mockResolvedValueOnce({
      data: { status: 'preview', checkedAt, replies: [] },
    });
  render(<AdminEmailReplies />);
  expect(get).not.toHaveBeenCalled();

  checkMailbox();
  expect(screen.getByRole('button', { name: 'Check mailbox' })).toBeDisabled();
  expect(
    await screen.findByText('The reply mailbox is not configured.'),
  ).toBeVisible();
  checkMailbox();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not read the reply mailbox.',
  );
  checkMailbox();
  expect(
    await screen.findByText('No unprocessed email replies.'),
  ).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('shows a candidate and renders email markup as text', async () => {
  const text = '<img src="https://example.test/tracking">';
  get.mockResolvedValueOnce({
    data: {
      status: 'preview',
      checkedAt,
      replies: [
        {
          id: 'reply-1',
          sender: 'member@example.test',
          recipients: ['hello+[redacted]@example.test'],
          matching: 'candidate',
          candidates: ['member_one'],
          parseResult: 'Extracted',
          extractedText: 'Thanks!',
          sourceText: text,
        },
        {
          id: 'reply-2',
          sender: 'another@example.test',
          recipients: ['hello@example.test'],
          matching: 'unmatched',
          candidates: [],
          parseResult: 'Empty',
          extractedText: '',
          sourceText: '> quoted text',
        },
      ],
    },
  });
  render(<AdminEmailReplies />);
  checkMailbox();
  expect(
    await screen.findByText('Message links in email point to member_one.'),
  ).toBeVisible();
  expect(screen.getByText('unmatched')).toBeVisible();
  fireEvent.click(screen.getAllByText('Show reply')[0]);
  expect(screen.getByText(text)).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
