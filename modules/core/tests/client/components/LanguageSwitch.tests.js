import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import i18n from '@/config/client/i18n';
import LanguageSwitch from '@/modules/core/client/components/LanguageSwitch';
import * as users from '@/modules/users/client/api/users.api';

const api = { users };

jest.mock('@/modules/users/client/api/users.api');
afterEach(() => jest.clearAllMocks());

beforeEach(() => i18n.changeLanguage('en'));

describe('default presentation', () => {
  it('opens a modal with language options and search', () => {
    render(<LanguageSwitch />);

    fireEvent.click(screen.getByText('Language: EN'));

    expect(screen.getByText('Select a language')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveAttribute(
      'placeholder',
      'Search languages…',
    );
    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('can filter and change language from the modal', async () => {
    render(<LanguageSwitch buttonStyle="primary" />);

    expect(screen.getByText('Language: EN')).toHaveClass('btn-primary');

    fireEvent.click(screen.getByText('Language: EN'));
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'Suomi' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Suomi' }));

    await waitFor(() =>
      expect(screen.getByText('Language: FI')).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.queryByText('Select a language')).not.toBeInTheDocument(),
    );
  });

  it('can save the language to the API', async () => {
    api.users.update.mockResolvedValue({});

    render(<LanguageSwitch saveToAPI={true} />);

    fireEvent.click(screen.getByText('Language: EN'));
    fireEvent.click(screen.getByRole('button', { name: 'Čeština' }));

    await waitFor(() =>
      expect(api.users.update).toHaveBeenCalledWith({ locale: 'cs' }),
    );
  });

  it('falls back to English when the current language is unknown', () => {
    i18n.changeLanguage('zz');

    render(<LanguageSwitch buttonStyle="inverse" />);

    expect(screen.getByRole('button', { name: 'Language: EN' })).toHaveClass(
      'btn-inverse',
    );
  });
});
