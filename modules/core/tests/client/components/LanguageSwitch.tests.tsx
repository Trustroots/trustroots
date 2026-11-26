import React from 'react';
import {
  render as rtlRender,
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react';
import i18n from '@/config/client/i18n';
import LanguageSwitch from '@/modules/core/client/components/LanguageSwitch';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';

const analytics = fakeAnalytics();
const render = (
  ui: React.ReactElement,
  options?: Parameters<typeof rtlRender>[1],
) => rtlRender(ui, { wrapper: analytics.wrapper, ...options });

afterEach(() => vi.clearAllMocks());

beforeEach(() => i18n.changeLanguage('en'));

it('updates document direction and loads the RTL stylesheet for Arabic', async () => {
  try {
    await i18n.changeLanguage('ar');
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    const stylesheet = document.getElementById('rtl-style');
    expect(stylesheet).toHaveAttribute(
      'href',
      expect.stringContaining('react-main.rtl.css'),
    );
    stylesheet?.dispatchEvent(new Event('load'));
  } finally {
    document.getElementById('rtl-style')?.remove();
    await i18n.changeLanguage('en');
  }
  expect(document.documentElement).toHaveAttribute('dir', 'ltr');
});

describe('default presentation', () => {
  it('opens a modal with language options and search', () => {
    render(<LanguageSwitch />);

    fireEvent.click(screen.getByRole('button', { name: 'English' }));

    expect(screen.getByText('Select a language')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveAttribute(
      'placeholder',
      'Search languages…',
    );
    expect(screen.getByRole('searchbox')).not.toHaveClass('form-control');
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
    const persistLanguage = vi.fn().mockResolvedValue(undefined);

    render(<LanguageSwitch onLanguageChange={persistLanguage} />);

    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    fireEvent.click(screen.getByRole('button', { name: 'Čeština' }));

    await waitFor(() =>
      expect(analytics.track).toHaveBeenCalledWith('language_switched', {
        language: 'cs',
        saved: 'yes',
      }),
    );
    expect(persistLanguage).toHaveBeenCalledWith('cs');
  });

  it('says the language was not saved when saving fails', async () => {
    const persistLanguage = vi.fn().mockRejectedValue(new Error('offline'));

    render(<LanguageSwitch onLanguageChange={persistLanguage} />);

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
