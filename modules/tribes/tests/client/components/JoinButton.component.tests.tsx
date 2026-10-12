import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import JoinButton from '@/modules/tribes/client/components/JoinButton';
import {
  join,
  leave,
  type MembershipUpdate,
  type TribeSummary,
} from '@/modules/tribes/client/api/tribes.api';
import type LeaveTribeModal from '@/modules/tribes/client/components/LeaveTribeModal';
import type Tooltip from '@/modules/core/client/components/Tooltip';
import type { UserProfile } from '@/modules/users/client/types';

const joinMock = jest.mocked(join);
const leaveMock = jest.mocked(leave);
const user: UserProfile = {
  _id: 'user-1',
  username: 'circle-member',
  displayName: 'Circle Member',
};

jest.mock('@/modules/tribes/client/api/tribes.api');

jest.mock('@/modules/core/client/components/Tooltip', () => {
  function MockTooltip({ children }: React.ComponentProps<typeof Tooltip>) {
    return <>{children}</>;
  }
  return MockTooltip;
});

jest.mock('@/modules/tribes/client/components/LeaveTribeModal', () => {
  function MockLeaveTribeModal({
    show,
    onConfirm,
    onCancel,
  }: React.ComponentProps<typeof LeaveTribeModal>) {
    if (!show) return null;
    return (
      <div role="dialog">
        <button onClick={onConfirm}>Leave circle</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  }

  return MockLeaveTribeModal;
});

describe('<JoinButton />', () => {
  const tribe: TribeSummary = {
    _id: 'tribe-1',
    slug: 'hitchhikers',
    label: 'Hitchhikers',
    count: 0,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('links signed-out visitors to signup with the tribe preselected', () => {
    render(<JoinButton tribe={tribe} user={undefined} onUpdated={jest.fn()} />);

    expect(screen.getByRole('link', { name: /Join/ })).toHaveAttribute(
      'href',
      '/signup?tribe=hitchhikers',
    );
  });

  it('joins a tribe and reports the updated membership', async () => {
    const onUpdated = jest.fn<void, [MembershipUpdate]>();
    const updatedMembership: MembershipUpdate = {
      user: { ...user, memberIds: ['tribe-1'] },
    };
    joinMock.mockResolvedValueOnce(updatedMembership);

    render(
      <JoinButton
        tribe={tribe}
        user={{ ...user, memberIds: [] }}
        onUpdated={onUpdated}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Join (Hitchhikers)' }));

    expect(
      await screen.findByRole('button', { name: 'Leave circle' }),
    ).toHaveClass('btn-active');
    expect(join).toHaveBeenCalledWith('tribe-1');
    expect(onUpdated).toHaveBeenCalledWith(updatedMembership);
  });

  it('supports a large iconless presentation', () => {
    render(
      <JoinButton
        className="btn btn-lg btn-default"
        icon={false}
        tribe={tribe}
        user={{ ...user, memberIds: ['tribe-1'] }}
        onUpdated={jest.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Leave circle' });
    expect(button).toHaveClass('btn-lg');
    expect(button.querySelector('i')).not.toBeInTheDocument();
  });

  it('supports distinct active styling and membership copy', () => {
    render(
      <JoinButton
        activeClassName="btn btn-lg btn-primary btn-action"
        className="btn btn-lg btn-default"
        icon={false}
        memberLabel="You're a member"
        tribe={tribe}
        user={{ ...user, memberIds: ['tribe-1'] }}
        onUpdated={jest.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Leave circle' });
    expect(button).toHaveTextContent("You're a member");
    expect(button).toHaveClass('btn-active', 'btn-primary', 'btn-action');
    expect(button).not.toHaveClass('btn-default');
  });

  it('does not start a second join while the first request is pending', async () => {
    joinMock.mockReturnValueOnce(new Promise(() => {}));

    render(
      <JoinButton
        tribe={tribe}
        user={{ ...user, memberIds: [] }}
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
    joinMock.mockReturnValueOnce(new Promise(() => {}));

    render(
      <JoinButton
        tribe={tribe}
        user={{ ...user, memberIds: [] }}
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
        user={{ ...user, memberIds: ['tribe-1'] }}
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
    const onUpdated = jest.fn<void, [MembershipUpdate]>();
    const updatedMembership: MembershipUpdate = {
      user: { ...user, memberIds: [] },
    };
    leaveMock.mockResolvedValueOnce(updatedMembership);

    render(
      <JoinButton
        tribe={tribe}
        user={{ ...user, memberIds: ['tribe-1'] }}
        onUpdated={onUpdated}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Leave circle' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Leave circle',
      }),
    );

    expect(
      await screen.findByRole('button', { name: 'Join (Hitchhikers)' }),
    ).not.toHaveClass('btn-active');
    expect(leave).toHaveBeenCalledWith('tribe-1');
    expect(onUpdated).toHaveBeenCalledWith(updatedMembership);
  });
});
