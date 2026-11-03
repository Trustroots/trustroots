import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminSignupReviewRules from '../../../client/components/AdminSignupReviewRules';
import http from '../../../../core/client/api/http-client';

jest.mock(
  '../../../client/components/AdminHeader.component',
  () =>
    function Header() {
      return <nav>Admin</nav>;
    },
);
jest.mock('../../../../core/client/api/http-client', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() },
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

const get = jest.mocked(http.get);
const put = jest.mocked(http.put);
const defaults = {
  revision: 3,
  rules: [
    { kind: 'keyword' as const, value: 'support' },
    { kind: 'keyword' as const, value: 'system' },
    { kind: 'keyword' as const, value: 'trustroots' },
  ],
};

beforeEach(() => jest.resetAllMocks());

test('loads, edits, adds, removes, and saves the complete watchlist', async () => {
  get.mockResolvedValueOnce({ data: defaults });
  put.mockResolvedValueOnce({
    data: {
      revision: 4,
      rules: [
        { kind: 'keyword', value: 'support' },
        { kind: 'keyword', value: 'trustroots' },
        { kind: 'domain', value: 'example.test' },
      ],
    },
  });

  render(<AdminSignupReviewRules />);
  expect(
    await screen.findByRole('table', { name: 'Watchlist rules' }),
  ).toBeVisible();
  expect(
    screen.getByText(/Matching signups are allowed and flagged/),
  ).toBeVisible();
  expect(screen.getByLabelText('Rule 2 value')).toHaveValue('system');

  fireEvent.change(screen.getByLabelText('Rule 2 value'), {
    target: { value: 'changed' },
  });
  fireEvent.change(screen.getByLabelText('Rule 1 type'), {
    target: { value: 'email' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Remove rule 3' }));
  fireEvent.change(screen.getByLabelText('New rule type'), {
    target: { value: 'domain' },
  });
  fireEvent.change(screen.getByLabelText('New rule value'), {
    target: { value: ' example.test ' },
  });
  fireEvent.keyDown(screen.getByLabelText('New rule value'), {
    key: 'x',
    code: 'KeyX',
  });
  fireEvent.keyDown(screen.getByLabelText('New rule value'), {
    key: 'Enter',
    code: 'Enter',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));

  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  expect(put).toHaveBeenCalledWith('/api/admin/signup-review-rules', {
    revision: 3,
    rules: [
      { kind: 'email', value: 'support' },
      { kind: 'keyword', value: 'changed' },
      { kind: 'domain', value: 'example.test' },
    ],
  });
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Signup watchlist saved.',
  );
});

test('requires explicit confirmation to save an empty watchlist', async () => {
  get.mockResolvedValueOnce({ data: { revision: 7, rules: [] } });
  put.mockResolvedValueOnce({ data: { revision: 8, rules: [] } });
  render(<AdminSignupReviewRules />);

  const emptyConfirmation = await screen.findByRole('checkbox', {
    name: 'I understand that saving an empty watchlist disables all signup review rules',
  });
  const saveButton = screen.getByRole('button', { name: 'Save rules' });
  expect(saveButton).toBeDisabled();

  fireEvent.click(emptyConfirmation);
  expect(saveButton).toBeEnabled();
  fireEvent.change(screen.getByLabelText('New rule value'), {
    target: { value: 'temporary' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Remove rule 1' }));
  const resetConfirmation = screen.getByRole('checkbox', {
    name: 'I understand that saving an empty watchlist disables all signup review rules',
  });
  expect(resetConfirmation).not.toBeChecked();
  expect(saveButton).toBeDisabled();

  fireEvent.click(resetConfirmation);
  fireEvent.click(saveButton);
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  expect(put).toHaveBeenCalledWith('/api/admin/signup-review-rules', {
    revision: 7,
    rules: [],
    confirmEmpty: true,
  });
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Signup watchlist saved.',
  );
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(saveButton).toBeDisabled();
});

test('does not update state after a pending watchlist load resolves on unmount', async () => {
  let resolveLoad!: (response: { data: typeof defaults }) => void;
  get.mockReturnValueOnce(
    new Promise(resolve => {
      resolveLoad = resolve;
    }),
  );
  const { unmount } = render(<AdminSignupReviewRules />);
  unmount();

  await act(async () => resolveLoad({ data: defaults }));
  expect(get).toHaveBeenCalledWith('/api/admin/signup-review-rules');
});

test('ignores a failed watchlist load after unmount', async () => {
  let rejectLoad!: (error: Error) => void;
  get.mockReturnValueOnce(
    new Promise((_resolve, reject) => {
      rejectLoad = reject;
    }),
  );
  const { unmount } = render(<AdminSignupReviewRules />);
  unmount();

  await act(async () => rejectLoad(new Error('unavailable')));
  expect(get).toHaveBeenCalledWith('/api/admin/signup-review-rules');
});

test('keeps focus while typing several characters into an existing rule', async () => {
  get.mockResolvedValueOnce({ data: defaults });
  render(<AdminSignupReviewRules />);

  const input = await screen.findByLabelText('Rule 1 value');
  input.focus();
  fireEvent.change(input, { target: { value: 'multi' } });
  expect(screen.getByLabelText('Rule 1 value')).toBe(input);
  fireEvent.change(input, { target: { value: 'multi-character' } });

  expect(input).toHaveValue('multi-character');
  expect(input).toHaveFocus();
});

test('reports stale revision save conflicts and keeps the edited rules visible', async () => {
  get.mockResolvedValueOnce({ data: defaults });
  put.mockRejectedValueOnce(new Error('stale revision'));
  render(<AdminSignupReviewRules />);

  fireEvent.change(await screen.findByLabelText('Rule 1 value'), {
    target: { value: 'new-keyword' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not save the signup watchlist. It may have changed; reload and review the latest rules.',
  );
  expect(screen.getByLabelText('Rule 1 value')).toHaveValue('new-keyword');
});

test('reports load errors and prevents saving before rules are loaded', async () => {
  get.mockRejectedValueOnce(new Error('unavailable'));
  render(<AdminSignupReviewRules />);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load the signup watchlist.',
  );
  expect(
    screen.queryByRole('button', { name: 'Save rules' }),
  ).not.toBeInTheDocument();
  expect(put).not.toHaveBeenCalled();
});

test('requires a value before adding a rule', async () => {
  get.mockResolvedValueOnce({ data: defaults });
  render(<AdminSignupReviewRules />);

  fireEvent.click(await screen.findByRole('button', { name: 'Add rule' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Enter a value for the rule.',
  );
  expect(screen.getAllByLabelText(/Rule \d+ value/)).toHaveLength(3);
});
