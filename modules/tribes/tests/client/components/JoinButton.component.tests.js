import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import JoinButton from '@/modules/tribes/client/components/JoinButton';
import { join, leave } from '@/modules/tribes/client/api/tribes.api';

jest.mock('@/modules/tribes/client/api/tribes.api');

jest.mock('@/modules/core/client/components/Tooltip', () => {
  const React = require('react');
  function MockTooltip({ children }) {
    return <>{children}</>;
  }
  MockTooltip.propTypes = { children: () => null };
  return MockTooltip;
});

jest.mock('@/modules/tribes/client/components/LeaveTribeModal', () => {
  const React = require('react');

  function MockLeaveTribeModal({ show, onConfirm, onCancel }) {
    if (!show) return null;
    return (
      <div role="dialog">
        <button onClick={onConfirm}>Leave circle</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  }

  MockLeaveTribeModal.propTypes = {
    show: () => null,
    onConfirm: () => null,
    onCancel: () => null,
  };

  return MockLeaveTribeModal;
});

describe('<JoinButton />', () => {
  const tribe = {
    _id: 'tribe-1',
    slug: 'hitchhikers',
    label: 'Hitchhikers',
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('links signed-out visitors to signup with the tribe preselected', () => {
    render(<JoinButton tribe={tribe} user={null} onUpdated={jest.fn()} />);

    expect(screen.getByRole('link', { name: /Join/ })).toHaveAttribute(
      'href',
      '/signup?tribe=hitchhikers',
    );
  });

  it('joins a tribe and reports the updated membership', async () => {
    const onUpdated = jest.fn();
    const updatedMembership = { memberIds: ['tribe-1'] };
    join.mockResolvedValueOnce(updatedMembership);

    render(
      <JoinButton
        tribe={tribe}
        user={{ _id: 'user-1', memberIds: [] }}
        onUpdated={onUpdated}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Join (Hitchhikers)' }));

    await waitFor(() => expect(join).toHaveBeenCalledWith('tribe-1'));
    expect(onUpdated).toHaveBeenCalledWith(updatedMembership);
    expect(screen.getByRole('button', { name: 'Leave circle' })).toHaveClass(
      'btn-active',
    );
  });

  it('does not start a second join while the first request is pending', async () => {
    join.mockReturnValueOnce(new Promise(() => {}));

    render(
      <JoinButton
        tribe={tribe}
        user={{ _id: 'user-1', memberIds: [] }}
        onUpdated={jest.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Join (Hitchhikers)' });
    fireEvent.click(button);
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await waitFor(() => expect(join).toHaveBeenCalledTimes(1));
    expect(button).toBeDisabled();
  });

  it('keeps the join button disabled while join is pending', async () => {
    join.mockReturnValueOnce(new Promise(() => {}));

    render(
      <JoinButton
        tribe={tribe}
        user={{ _id: 'user-1', memberIds: [] }}
        onUpdated={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Join (Hitchhikers)' }));

    expect(
      await screen.findByRole('button', { name: 'Join (Hitchhikers)' }),
    ).toBeDisabled();
  });

  it('cancels leaving a tribe from the confirmation modal', () => {
    render(
      <JoinButton
        tribe={tribe}
        user={{ _id: 'user-1', memberIds: ['tribe-1'] }}
        onUpdated={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Leave circle' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(leave).not.toHaveBeenCalled();
  });

  it('leaves a tribe after confirmation and reports the update', async () => {
    const onUpdated = jest.fn();
    const updatedMembership = { memberIds: [] };
    leave.mockResolvedValueOnce(updatedMembership);

    render(
      <JoinButton
        tribe={tribe}
        user={{ _id: 'user-1', memberIds: ['tribe-1'] }}
        onUpdated={onUpdated}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Leave circle' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Leave circle',
      }),
    );

    await waitFor(() => expect(leave).toHaveBeenCalledWith('tribe-1'));
    expect(onUpdated).toHaveBeenCalledWith(updatedMembership);
    expect(
      screen.getByRole('button', { name: 'Join (Hitchhikers)' }),
    ).not.toHaveClass('btn-active');
  });
});
