import React from 'react';
import { screen, render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { getLocales } from '@/modules/core/client/utils/locales';
import i18n from '@/config/client/i18n';
import LanguageSwitch from '@/modules/core/client/components/LanguageSwitch';
import * as users from '@/modules/users/client/api/users.api';

const api = { users };

const locales = getLocales();
const localeNames = locales.map(locale => locale.label);

jest.mock('@/modules/users/client/api/users.api');
afterEach(() => jest.clearAllMocks());

beforeEach(() => i18n.changeLanguage('en'));

// @TODO: Fix tests to open a modal instead of dropdown
// https://github.com/Trustroots/trustroots/issues/2162
describe.skip('default presentation', () => {
  it('has a menu item for each language', async () => {
    render(<LanguageSwitch />);
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(locales.length);
    const names = items.map(item => item.innerHTML);
    expect(names).toEqual(localeNames);
  });

  it('can change language', async () => {
    render(<LanguageSwitch />);
    expect(screen.queryByRole('button')).toHaveTextContent('English');
    fireEvent.click(screen.getByText('česky'));
    expect(screen.queryByRole('button')).toHaveTextContent('česky');
  });

  it('can save the language to the API', async () => {
    render(<LanguageSwitch saveToAPI={true} />);
    fireEvent.click(screen.getByText('česky'));
    expect(api.users.update).toHaveBeenCalledWith({ locale: 'cs' });
  });
});
