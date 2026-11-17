import React from 'react';
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { fakeAnalytics } from '@/testutils/client/analytics.testutil';
import '@/config/client/i18n';
import JoinButton from '@/modules/tribes/client/components/JoinButton';
import {
  join,
  leave,
  type MembershipUpdate,
  type TribeSummary,
} from '@/modules/tribes/client/api/tribes.api';
import type LeaveTribeModal from '@/modules/tribes/client/components/LeaveTribeModal';
import type { UserProfile } from '@/modules/users/client/types';

const analytics = fakeAnalytics();
const render = (...[ui, options]: Parameters<typeof rtlRender>) =>
  rtlRender(ui, { wrapper: analytics.wrapper, ...options });

const joinMock = vi.mocked(join);
const leaveMock = vi.mocked(leave);
const user: UserProfile = {
  _id: 'user-1',
  username: 'circle-member',
  displayName: 'Circle Member',
};

vi.mock('@/modules/tribes/client/api/tribes.api');

vi.mock('@/modules/tribes/client/components/LeaveTribeModal', () => {
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

  return { default: MockLeaveTribeModal };
});

describe('<JoinButton />', () => {
  const tribe: TribeSummary = {
    _id: 'tribe-1',
    slug: 'hitchhikers',
    label: 'Hitchhikers',
    count: 0,
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('links signed-out visitors to signup with the tribe preselected', () => {
    render(<JoinButton tribe={tribe} user={undefined} onUpdated={vi.fn()} />);

    expect(screen.getByRole('link', { name: /Join/ })).toHaveAttribute(
      'href',
      '/signup?tribe=hitchhikers',
    );
  });

  it('joins a tribe and reports the updated membership', async () => {
    const onUpdated = vi.fn<(...args: [MembershipUpdate]) => void>();
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
    ).toHaveClass('tribe-join-active');
    expect(join).toHaveBeenCalledWith('tribe-1');
    expect(onUpdated).toHaveBeenCalledWith(updatedMembership);
    expect(analytics.track).toHaveBeenCalledWith('circle_joined', {
      source: 'other',
    });
  });

  it('asks for an optional reason on circle pages and submits it trimmed', async () => {
    const updatedMembership: MembershipUpdate = {
      user: { ...user, memberIds: ['tribe-1'] },
    };
    joinMock.mockResolvedValueOnce(updatedMembership);

    render(
      <JoinButton
        source="circle_page"
        tribe={tribe}
        user={{ ...user, memberIds: [] }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Join (Hitchhikers)' }));
    const dialog = await screen.findByRole('dialog');
    const reason = within(dialog).getByRole('textbox');
    expect(reason).toHaveAttribute('maxLength', '160');
    fireEvent.change(reason, {
      target: { value: '  I enjoy sharing journeys.  ' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Join circle' }),
    );

    await waitFor(() =>
      expect(join).toHaveBeenCalledWith('tribe-1', {
        joinReason: 'I enjoy sharing journeys.',
      }),
    );
    expect(
      await screen.findByRole('button', { name: 'Leave circle' }),
    ).toBeVisible();
  });

  it('lets a member cancel or retry joining from the circle page', async () => {
    joinMock
      .mockRejectedValueOnce(new Error('Join failed'))
      .mockResolvedValueOnce({ user: { ...user, memberIds: ['tribe-1'] } });
    render(
      <JoinButton
        source="circle_page"
        tribe={tribe}
        user={{ ...user, memberIds: [] }}
      />,
    );

    const open = screen.getByRole('button', { name: 'Join (Hitchhikers)' });
    fireEvent.click(open);
    const firstDialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(firstDialog).getByRole('button', { name: 'Cancel' }),
    );
    await waitFor(() => expect(firstDialog).not.toBeInTheDocument());
    expect(joinMock).not.toHaveBeenCalled();

    fireEvent.click(open);
    const dialog = await screen.findByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: 'Join circle' });
    fireEvent.click(submit);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Could not join the circle. Please try again.',
    );
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(
      await screen.findByRole('button', { name: 'Leave circle' }),
    ).toBeVisible();
    expect(joinMock).toHaveBeenLastCalledWith('tribe-1');
  });

  it('re-enables the button after a failed join without tracking it', async () => {
    const onUpdated = vi.fn();
    joinMock.mockRejectedValueOnce(new Error('join failed'));

    render(
      <JoinButton
        tribe={tribe}
        user={{ ...user, memberIds: [] }}
        onUpdated={onUpdated}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Join (Hitchhikers)' }));

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Join (Hitchhikers)' }),
      ).toBeEnabled(),
    );
    expect(joinMock).toHaveBeenCalledTimes(1);
    expect(analytics.track).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('supports a large iconless presentation', () => {
    render(
      <JoinButton
        look={{ size: 'lg' }}
        icon={false}
        tribe={tribe}
        user={{ ...user, memberIds: ['tribe-1'] }}
        onUpdated={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Leave circle' });
    expect(button).toHaveAttribute('data-size', 'lg');
    expect(button.querySelector('i')).not.toBeInTheDocument();
  });

  it('supports distinct active styling and membership copy', () => {
    render(
      <JoinButton
        activeLook={{ size: 'xl', intent: 'primary' }}
        look={{ size: 'lg' }}
        icon={false}
        memberLabel="You're a member"
        tribe={tribe}
        user={{ ...user, memberIds: ['tribe-1'] }}
        onUpdated={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Leave circle' });
    expect(button).toHaveTextContent("You're a member");
    expect(button).toHaveClass('tribe-join-active');
    expect(button).toHaveAttribute('data-intent', 'primary');
    expect(button).toHaveAttribute('data-size', 'xl');
  });

  it('does not start a second join while the first request is pending', async () => {
    joinMock.mockReturnValueOnce(new Promise(() => {}));

    render(
      <JoinButton
        tribe={tribe}
        user={{ ...user, memberIds: [] }}
        onUpdated={vi.fn()}
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
        onUpdated={vi.fn()}
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
        onUpdated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Leave circle' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(leave).not.toHaveBeenCalled();
  });

  it('leaves a tribe after confirmation and reports the update', async () => {
    const onUpdated = vi.fn<(...args: [MembershipUpdate]) => void>();
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
    ).not.toHaveClass('tribe-join-active');
    expect(leave).toHaveBeenCalledWith('tribe-1');
    expect(onUpdated).toHaveBeenCalledWith(updatedMembership);
    expect(analytics.track).toHaveBeenCalledWith('circle_left', {
      source: 'other',
    });
  });

  it('keeps the membership and closes the dialog when leaving fails', async () => {
    const onUpdated = vi.fn<(...args: [MembershipUpdate]) => void>();
    leaveMock.mockRejectedValueOnce(new Error('offline'));

    render(
      <JoinButton
        source="profile"
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

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Leave circle' })).toBeEnabled();
    expect(onUpdated).not.toHaveBeenCalled();
    expect(analytics.track).not.toHaveBeenCalled();
  });
});
