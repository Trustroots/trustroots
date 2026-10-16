import React from 'react';
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import MemberViewBanner from '../../../client/components/MemberViewBanner';
import http from '../../../client/api/http-client';
import { viewNavigation } from '../../../client/services/member-view';
import { signout } from '../../../client/react-app/shell-helpers';

jest.mock('../../../client/react-app/shell-helpers', () => ({
  signout: jest.fn(),
}));

jest.mock('../../../client/api/http-client', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn() },
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
}));
describe('member-view banner', () => {
  beforeEach(() => {
    window.viewContext = {
      generation: 'example-generation',
      username: 'examplemember',
      expiresAt: Date.now() + 60000,
    };
    jest.spyOn(viewNavigation, 'reload').mockImplementation(() => {});
    jest.spyOn(viewNavigation, 'transition').mockImplementation(() => {});
  });
  afterEach(() => {
    delete window.viewContext;
    delete window.user;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('does not show for ordinary or restored sessions', () => {
    delete window.viewContext;
    const { rerender } = render(<MemberViewBanner />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    window.viewContext = { generation: 'restored' };
    rerender(<MemberViewBanner />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
  it('shows the identity and deadline and explicitly returns to the administrator', async () => {
    jest
      .mocked(http.post)
      .mockResolvedValue({ data: { redirect: '/admin/user/examplemember' } });
    render(<MemberViewBanner />);
    expect(
      screen.getByRole('complementary', { name: 'Member view' }),
    ).toHaveTextContent('Viewing as examplemember — read-only');
    expect(screen.getByText(/Ends at/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Return to your account' }),
    );
    expect(screen.getByRole('button', { name: 'Returning…' })).toBeDisabled();
    await waitFor(() =>
      expect(viewNavigation.transition).toHaveBeenCalledWith(
        '/admin/user/examplemember',
      ),
    );
  });
  it('keeps departure usable after a failed request', async () => {
    jest.mocked(http.post).mockRejectedValue(new Error('offline'));
    window.viewContext!.expired = true;
    render(<MemberViewBanner />);
    expect(screen.getByText(/This member view has ended/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Return to your account' }),
    );
    await screen.findByRole('alert');
    expect(
      screen.getByRole('button', { name: 'Return to your account' }),
    ).toBeEnabled();
  });
  it('reloads private content away at the deadline', () => {
    jest.useFakeTimers();
    window.viewContext!.expiresAt = Date.now() + 500;
    render(<MemberViewBanner />);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(viewNavigation.reload).toHaveBeenCalled();
  });
  it('synchronises storage events and ignores unrelated keys', () => {
    render(<MemberViewBanner />);
    fireEvent(window, new StorageEvent('storage', { key: 'other' }));
    expect(viewNavigation.reload).not.toHaveBeenCalled();
    fireEvent(
      window,
      new StorageEvent('storage', { key: 'trustroots-view-change' }),
    );
    expect(viewNavigation.reload).toHaveBeenCalledTimes(1);
  });
  it('offers sign-out when the original account cannot be restored', () => {
    window.viewContext!.expired = true;
    render(<MemberViewBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signout).toHaveBeenCalled();
  });
  it.each([undefined, 'example-generation', 'different'])(
    'rechecks the server context on focus (%s)',
    async generation => {
      if (!generation) delete window.viewContext;
      jest
        .mocked(http.get)
        .mockResolvedValue({ data: { viewGeneration: generation } });
      render(<MemberViewBanner />);
      fireEvent.focus(window);
      await waitFor(() => expect(http.get).toHaveBeenCalled());
      if (generation === 'different')
        await waitFor(() => expect(viewNavigation.reload).toHaveBeenCalled());
      else expect(viewNavigation.reload).not.toHaveBeenCalled();
    },
  );
  it('shows a context-check failure without silently switching accounts', async () => {
    jest.mocked(http.get).mockRejectedValue(new Error('offline'));
    render(<MemberViewBanner />);
    fireEvent.focus(window);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not check your account view',
    );
  });
  it.each([null, 'different-member-id'])(
    'reloads when the effective identity changes (%s)',
    async userId => {
      window.user = { _id: 'example-member-id' };
      jest.mocked(http.get).mockResolvedValue({
        data: { viewGeneration: 'example-generation', userId },
      });
      render(<MemberViewBanner />);
      fireEvent.focus(window);
      await waitFor(() => expect(viewNavigation.reload).toHaveBeenCalled());
    },
  );
});
