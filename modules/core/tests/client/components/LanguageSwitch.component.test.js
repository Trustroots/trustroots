import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import i18n from '@/config/client/i18n';
import locales from '@/config/shared/locales';
import LanguageSwitch from '@/modules/core/client/components/LanguageSwitch.component';

import * as users from '@/modules/users/client/api/users.api';
const api = { users };

const localeNames = locales.map(locale => locale.label);

jest.mock('@/modules/users/client/api/users.api');
afterEach(() => jest.clearAllMocks());

beforeEach(() => i18n.changeLanguage('en'));

describe('default presentation', () => {

  it('has a menu item for each language', async () => {
    const { getAllByRole } = render(<LanguageSwitch/>);
    const items = getAllByRole('menuitem');
    expect(items).toHaveLength(4);
    const names = items.map(item => item.innerHTML);
    expect(names).toEqual(localeNames);
  });

  it('can change language', async () => {
    const { queryByRole, getByText } = render(<LanguageSwitch/>);
    expect(queryByRole('button')).toHaveTextContent('English');
    fireEvent.click(getByText('česky'));
    expect(queryByRole('button')).toHaveTextContent('česky');
  });

  it('can save the language to the API', async () => {
    const { getByText } = render(<LanguageSwitch saveToAPI={true}/>);
    fireEvent.click(getByText('česky'));
    expect(api.users.update).toHaveBeenCalledWith({ locale: 'cs' });
  });

});

describe('select presentation', () => {

  it('has an option for each language', async () => {
    const { getAllByRole } = render(<LanguageSwitch presentation="select"/>);
    const items = getAllByRole('option');
    expect(items).toHaveLength(4);
    const names = items.map(item => item.innerHTML);
    expect(names).toEqual(localeNames);
  });

  it('can change language', async () => {
    const { getByRole, getByText } = render(<LanguageSwitch presentation="select"/>);
    expect(selectedOption(getByRole('combobox'))).toHaveTextContent('English');
    fireEvent.change(getByRole('combobox'), { target: getByText('česky') });
    expect(selectedOption(getByRole('combobox'))).toHaveTextContent('česky');
  });

  it('can save the language to the API', async () => {
    const { getByRole, getByText } = render(<LanguageSwitch presentation="select" saveToAPI={true}/>);
    fireEvent.change(getByRole('combobox'), { target: { value: getByText('česky').value } });
    expect(api.users.update).toHaveBeenCalledWith({ locale: 'cs' });
  });

});

function selectedOption(selectElement) {
  if (!selectElement) return null;
  return Array.from(selectElement.options).find(option => option.selected);
}
