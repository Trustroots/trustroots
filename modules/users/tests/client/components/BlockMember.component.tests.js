import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import BlockMember from '@/modules/users/client/components/BlockMember.component';
import * as blockApi from '@/modules/users/client/api/block.api';

jest.mock('@/modules/users/client/api/block.api', () => ({
  block: jest.fn(),
  unblock: jest.fn(),
}));

describe('<BlockMember />', () => {
  const originalConfirm = window.confirm;
  const originalAlert = window.alert;
  const originalGlobalAlert = global.alert;

  beforeEach(() => {
    blockApi.block.mockReset();
    blockApi.unblock.mockReset();
    window.confirm = jest.fn();
    window.alert = jest.fn();
    global.alert = window.alert;
  });

  afterAll(() => {
    window.confirm = originalConfirm;
    window.alert = originalAlert;
    global.alert = originalGlobalAlert;
  });

  it('renders the block action for unblocked members', () => {
    render(<BlockMember username="alice" className="btn-test" />);

    expect(
      screen.getByRole('button', { name: 'Block member "alice"' }),
    ).toHaveClass('btn-test');
  });

  it('does not call the block API when confirmation is cancelled', () => {
    window.confirm.mockReturnValue(false);
    render(<BlockMember username="alice" />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Block member "alice"' }),
    );

    expect(blockApi.block).not.toHaveBeenCalled();
  });

  it('does not call the unblock API when confirmation is cancelled', () => {
    window.confirm.mockReturnValue(false);
    render(<BlockMember username="alice" isBlocked />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Unblock member "alice"' }),
    );

    expect(blockApi.unblock).not.toHaveBeenCalled();
  });

  it('blocks without showing an error when the API succeeds', async () => {
    window.confirm.mockReturnValue(true);
    blockApi.block.mockResolvedValue(true);
    render(<BlockMember username="alice" />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Block member "alice"' }),
    );

    await waitFor(() => expect(blockApi.block).toHaveBeenCalledWith('alice'));
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('unblocks without showing an error when the API succeeds', async () => {
    window.confirm.mockReturnValue(true);
    blockApi.unblock.mockResolvedValue(true);
    render(<BlockMember username="alice" isBlocked />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Unblock member "alice"' }),
    );

    await waitFor(() => expect(blockApi.unblock).toHaveBeenCalledWith('alice'));
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('alerts when blocking fails', async () => {
    window.confirm.mockReturnValue(true);
    blockApi.block.mockResolvedValue(false);
    render(<BlockMember username="alice" />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Block member "alice"' }),
    );

    await waitFor(() => expect(blockApi.block).toHaveBeenCalledWith('alice'));
    expect(window.alert).toHaveBeenCalledWith(
      'Could not block this member.\n\nPlease ensure you are connected to internet and try again.',
    );
  });

  it('alerts when unblocking fails', async () => {
    window.confirm.mockReturnValue(true);
    blockApi.unblock.mockResolvedValue(false);
    render(<BlockMember username="alice" isBlocked />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Unblock member "alice"' }),
    );

    await waitFor(() => expect(blockApi.unblock).toHaveBeenCalledWith('alice'));
    expect(window.alert).toHaveBeenCalledWith(
      'Could not unblock this member.\n\nPlease ensure you are connected to internet and try again.',
    );
  });
});
