import React from 'react';
import {
  render as rtlRender,
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import i18n from '@/config/client/i18n';
import LanguageSwitch from '@/modules/core/client/components/LanguageSwitch';
import * as usersApi from '@/modules/users/client/api/users.api';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';

const analytics = fakeAnalytics();
const render = (
  ui: React.ReactElement,
  options?: Parameters<typeof rtlRender>[1],
) => rtlRender(ui, { wrapper: analytics.wrapper, ...options });

const updateUserMock = jest.mocked(usersApi.update);

jest.mock('@/modules/users/client/api/users.api');
afterEach(() => jest.clearAllMocks());

beforeEach(() => i18n.changeLanguage('en'));

describe('default presentation', () => {
  it('opens a modal with language options and search', () => {
    render(<LanguageSwitch />);

    fireEvent.click(screen.getByRole('button', { name: 'English' }));

    expect(screen.getByText('Select a language')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveAttribute(
      'placeholder',
      'Search languages…',
    );
    expect(
      screen.getByRole('searchbox', { name: 'Search languages…' }),
    ).toBeInTheDocument();
    expect(screen.getByText('English', { selector: 'strong' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('can filter and change language from the modal', async () => {
    render(<LanguageSwitch />);

    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
      'data-variant',
      'solid',
    );

    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'Suomi' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Suomi' }));

    await waitFor(() => expect(screen.getByTitle('Suomi')).toBeInTheDocument());
    expect(analytics.track).toHaveBeenCalledWith('language_switched', {
      language: 'fi',
      saved: 'no',
    });
    await waitFor(() =>
      expect(screen.queryByText('Select a language')).not.toBeInTheDocument(),
    );
  });

  it('can save the language to the API', async () => {
    updateUserMock.mockResolvedValue({
      _id: 'member-1',
      username: 'member',
      displayName: 'Member',
    });

    render(<LanguageSwitch saveToAPI={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    fireEvent.click(screen.getByRole('button', { name: 'Čeština' }));

    await waitFor(() =>
      expect(analytics.track).toHaveBeenCalledWith('language_switched', {
        language: 'cs',
        saved: 'yes',
      }),
    );
    expect(updateUserMock).toHaveBeenCalledWith({ locale: 'cs' });
  });

  it('says the language was not saved when saving fails', async () => {
    updateUserMock.mockRejectedValue(new Error('offline'));

    render(<LanguageSwitch saveToAPI={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    fireEvent.click(screen.getByRole('button', { name: 'Čeština' }));

    await waitFor(() =>
      expect(analytics.track).toHaveBeenCalledWith('language_switched', {
        language: 'cs',
        saved: 'no',
      }),
    );
    expect(screen.getByTitle('Čeština')).toBeInTheDocument();
  });

  it('falls back to English when the current language is unknown', () => {
    i18n.changeLanguage('zz');

    render(<LanguageSwitch buttonStyle="inverse" />);

    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
      'data-intent',
      'inverse',
    );
  });
});
