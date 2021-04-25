import React from 'react';
import { render, fireEvent } from '@testing-library/react';
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
    const { getAllByRole } = render(<LanguageSwitch />);
    const items = getAllByRole('menuitem');
    expect(items).toHaveLength(locales.length);
    const names = items.map(item => item.innerHTML);
    expect(names).toEqual(localeNames);
  });

  it('can change language', async () => {
    const { queryByRole, getByText } = render(<LanguageSwitch />);
    expect(queryByRole('button')).toHaveTextContent('English');
    fireEvent.click(getByText('česky'));
    expect(queryByRole('button')).toHaveTextContent('česky');
  });

  it('can save the language to the API', async () => {
    const { getByText } = render(<LanguageSwitch saveToAPI={true} />);
    fireEvent.click(getByText('česky'));
    expect(api.users.update).toHaveBeenCalledWith({ locale: 'cs' });
  });
});
