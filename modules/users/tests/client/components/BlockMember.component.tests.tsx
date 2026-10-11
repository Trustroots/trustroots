import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import BlockMember from '@/modules/users/client/components/BlockMember.component';
import * as blockApi from '@/modules/users/client/api/block.api';

const blockMock = jest.mocked(blockApi.block);
const unblockMock = jest.mocked(blockApi.unblock);

jest.mock('@/modules/users/client/api/block.api', () => ({
  block: jest.fn(),
  unblock: jest.fn(),
}));

describe('<BlockMember />', () => {
  const confirmMock = jest.spyOn(window, 'confirm');
  const alertMock = jest.spyOn(window, 'alert');
  const originalGlobalAlert = global.alert;

  beforeEach(() => {
    blockMock.mockReset();
    unblockMock.mockReset();
    confirmMock.mockReset();
    alertMock.mockReset();
    global.alert = window.alert;
  });

  afterAll(() => {
    confirmMock.mockRestore();
    alertMock.mockRestore();
    global.alert = originalGlobalAlert;
  });

  it('renders the block action for unblocked members', () => {
    render(<BlockMember username="alice" className="btn-test" />);

    expect(
      screen.getByRole('button', { name: 'Block member "alice"' }),
    ).toHaveClass('btn-test');
  });

  it('does not call the block API when confirmation is cancelled', () => {
    confirmMock.mockReturnValue(false);
    render(<BlockMember username="alice" />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Block member "alice"' }),
    );

    expect(blockMock).not.toHaveBeenCalled();
  });

  it('does not call the unblock API when confirmation is cancelled', () => {
    confirmMock.mockReturnValue(false);
    render(<BlockMember username="alice" isBlocked />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Unblock member "alice"' }),
    );

    expect(unblockMock).not.toHaveBeenCalled();
  });

  it('blocks without showing an error when the API succeeds', async () => {
    confirmMock.mockReturnValue(true);
    blockMock.mockResolvedValue(true);
    render(<BlockMember username="alice" />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Block member "alice"' }),
    );

    await waitFor(() => expect(blockMock).toHaveBeenCalledWith('alice'));
    expect(alertMock).not.toHaveBeenCalled();
  });

  it('unblocks without showing an error when the API succeeds', async () => {
    confirmMock.mockReturnValue(true);
    unblockMock.mockResolvedValue(true);
    render(<BlockMember username="alice" isBlocked />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Unblock member "alice"' }),
    );

    await waitFor(() => expect(unblockMock).toHaveBeenCalledWith('alice'));
    expect(alertMock).not.toHaveBeenCalled();
  });

  it('alerts when blocking fails', async () => {
    confirmMock.mockReturnValue(true);
    blockMock.mockResolvedValue(false);
    render(<BlockMember username="alice" />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Block member "alice"' }),
    );

    await waitFor(() => expect(blockMock).toHaveBeenCalledWith('alice'));
    expect(alertMock).toHaveBeenCalledWith(
      'Could not block this member.\n\nPlease ensure you are connected to internet and try again.',
    );
  });

  it('alerts when unblocking fails', async () => {
    confirmMock.mockReturnValue(true);
    unblockMock.mockResolvedValue(false);
    render(<BlockMember username="alice" isBlocked />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Unblock member "alice"' }),
    );

    await waitFor(() => expect(unblockMock).toHaveBeenCalledWith('alice'));
    expect(alertMock).toHaveBeenCalledWith(
      'Could not unblock this member.\n\nPlease ensure you are connected to internet and try again.',
    );
  });
});
