import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MasqueradeStart from '../../../client/components/MasqueradeStart';
import http from '@/modules/core/client/api/http-client';
import { viewNavigation } from '@/modules/core/client/services/member-view';

jest.mock('@/modules/core/client/api/http-client', () => ({
  __esModule: true,
  default: { post: jest.fn() },
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
}));
describe('member-view entry', () => {
  afterEach(() => jest.restoreAllMocks());
  function open() {
    render(<MasqueradeStart targetId="example-member-id" />);
    fireEvent.click(
      screen.getByRole('button', { name: 'View as this member' }),
    );
  }
  function fill() {
    fireEvent.change(screen.getByLabelText('Your password'), {
      target: { value: 'FictionalPassword123!' },
    });
    fireEvent.change(screen.getByLabelText('Investigation reason'), {
      target: { value: 'Reproduce a display problem' },
    });
  }
  it('explains the private-page scope and cancels without making a request', async () => {
    open();
    fill();
    expect(screen.getByText(/including private pages/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(http.post).not.toHaveBeenCalled();
  });
  it('submits credentials once and reloads into the member view', async () => {
    const transition = jest
      .spyOn(viewNavigation, 'transition')
      .mockImplementation(() => {});
    let finish!: (value: { data: { redirect: string } }) => void;
    jest.mocked(http.post).mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    open();
    fill();
    fireEvent.click(
      screen.getByRole('button', { name: 'Open read-only view' }),
    );
    expect(screen.getByRole('button', { name: 'Opening…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      keyCode: 27,
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    finish({ data: { redirect: '/profile/examplemember' } });
    await waitFor(() =>
      expect(transition).toHaveBeenCalledWith('/profile/examplemember'),
    );
    expect(http.post).toHaveBeenCalledWith('/api/auth/masquerade', {
      targetId: 'example-member-id',
      password: 'FictionalPassword123!',
      reason: 'Reproduce a display problem',
    });
    expect(screen.getByLabelText('Your password')).toHaveValue('');
  });
  it('clears the password and allows a retry after an error', async () => {
    jest.mocked(http.post).mockRejectedValue(new Error('unavailable'));
    open();
    fill();
    fireEvent.click(
      screen.getByRole('button', { name: 'Open read-only view' }),
    );
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Your password')).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Open read-only view' }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  });
});
