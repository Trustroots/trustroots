import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';

import '@/config/client/i18n';
import LanguageSelect from '@/modules/core/client/components/LanguageSelect';
import {
  useLanguagesQuery,
  type LanguageOption,
} from '@/modules/core/client/api/languages.api';

vi.mock('@/modules/core/client/api/languages.api');

const languages = [
  { value: 'eng', label: 'English' },
  { value: 'fin', label: 'Finnish' },
  { value: 'enm', label: 'Middle English', deprecated: true },
  { value: 'rcf', label: 'Réunion Creole French' },
];

function mockQuery(result: Partial<UseQueryResult<LanguageOption[], Error>>) {
  vi.mocked(useLanguagesQuery).mockReturnValue(
    result as UseQueryResult<LanguageOption[], Error>,
  );
}

beforeEach(() => mockQuery({ data: languages }));

function search(query: string) {
  const input = screen.getByRole('combobox');
  act(() => input.focus());
  fireEvent.input(input, { target: { value: query }, inputType: 'insertText' });
  return input;
}

it('forwards the accessible name and uses the provided placeholder', () => {
  render(
    <LanguageSelect aria-label="Languages" placeholder="Pick a language" />,
  );
  expect(screen.getByRole('combobox', { name: 'Languages' })).toHaveAttribute(
    'placeholder',
    'Pick a language',
  );
});

it('disables the field while loading and re-enables it when data arrives', () => {
  mockQuery({ isLoading: true });
  const { rerender } = render(<LanguageSelect />);
  expect(screen.getByPlaceholderText('Loading…')).toBeDisabled();

  mockQuery({ data: languages });
  rerender(<LanguageSelect />);
  expect(screen.getByPlaceholderText('Select…')).toBeEnabled();
});

it('shows an alert and disables the field when the language query fails', () => {
  mockQuery({ isError: true, data: languages });
  render(<LanguageSelect />);
  expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  expect(screen.getByRole('combobox')).toBeDisabled();
});

it('prefills languages in catalogue order and keeps existing deprecated values', () => {
  render(
    <LanguageSelect
      excludeDeprecated
      preSelectedLanguages={['enm', 'fin', 'eng']}
    />,
  );
  expect(
    screen
      .getAllByRole('button')
      .map(button => button.getAttribute('aria-label')),
  ).toEqual(['Remove English', 'Remove Finnish', 'Remove Middle English']);
});

it('prompts for a longer query and matches labels without accents', async () => {
  render(<LanguageSelect />);
  search('r');
  expect(await screen.findByText('Start typing a language…')).toBeVisible();
  expect(screen.queryByRole('option')).not.toBeInTheDocument();
  search('reunion');
  expect(
    await screen.findByRole('option', { name: 'Réunion Creole French' }),
  ).toBeVisible();
  search('no language with this label');
  expect(
    await screen.findByText('No languages found; try typing something else.'),
  ).toBeVisible();
});

it('hides deprecated choices in the profile', async () => {
  render(<LanguageSelect excludeDeprecated />);
  search('Middle');
  expect(
    await screen.findByText('No languages found; try typing something else.'),
  ).toBeVisible();
  expect(
    screen.queryByRole('option', { name: 'Middle English' }),
  ).not.toBeInTheDocument();
});

it('offers deprecated choices in the search filter and updates without a callback', async () => {
  render(<LanguageSelect />);
  search('Middle');
  fireEvent.click(
    await screen.findByRole('option', { name: 'Middle English' }),
  );
  expect(
    screen.getByRole('button', { name: 'Remove Middle English' }),
  ).toBeVisible();
});

it('selects through the keyboard and forwards codes when choices are removed', async () => {
  const onChangeLanguages = vi.fn();
  render(
    <LanguageSelect
      onChangeLanguages={onChangeLanguages}
      preSelectedLanguages={['eng']}
    />,
  );
  const input = search('Finn');
  const option = await screen.findByRole('option', { name: 'Finnish' });
  await waitFor(() =>
    expect(input).toHaveAttribute('aria-activedescendant', option.id),
  );
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onChangeLanguages).toHaveBeenLastCalledWith(['eng', 'fin']);
  fireEvent.click(screen.getByRole('button', { name: 'Remove Finnish' }));
  expect(onChangeLanguages).toHaveBeenLastCalledWith(['eng']);
  fireEvent.click(screen.getByRole('button', { name: 'Remove English' }));
  expect(onChangeLanguages).toHaveBeenLastCalledWith([]);
});
