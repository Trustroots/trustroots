import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import LanguageSelect from '@/modules/core/client/components/LanguageSelect';
import { useLanguagesQuery } from '@/modules/core/client/api/languages.api';

const asyncSelectProps = [];
jest.mock('react-select/async', () => {
  const React = require('react');
  const PropTypes = require('prop-types');

  function MockAsyncSelect(props) {
    asyncSelectProps.push(props);
    return (
      <div>
        <div>{props.placeholder}</div>
      </div>
    );
  }

  MockAsyncSelect.propTypes = {
    placeholder: PropTypes.string,
  };

  return MockAsyncSelect;
});

jest.mock('@/modules/core/client/api/languages.api');

afterEach(() => {
  jest.clearAllMocks();
  asyncSelectProps.length = 0;
});

describe('<LanguageSelect />', () => {
  it('renders the select once languages are loaded', () => {
    useLanguagesQuery.mockReturnValue({
      data: [
        { value: 'eng', label: 'English' },
        { value: 'fin', label: 'Finnish' },
      ],
      isLoading: false,
      isError: false,
    });

    render(<LanguageSelect placeholder="Pick a language" />);

    expect(screen.getByText('Pick a language')).toBeInTheDocument();
  });

  it('shows an error alert when languages fail to load', () => {
    useLanguagesQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<LanguageSelect />);

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('prefills selected languages from preSelectedLanguages', async () => {
    useLanguagesQuery.mockReturnValue({
      data: [
        { value: 'eng', label: 'English' },
        { value: 'fin', label: 'Finnish' },
        { value: 'swe', label: 'Swedish' },
      ],
      isLoading: false,
      isError: false,
    });

    render(<LanguageSelect preSelectedLanguages={['fin', 'eng']} />);

    await waitFor(() => {
      expect(asyncSelectProps.at(-1).value).toEqual([
        { value: 'eng', label: 'English' },
        { value: 'fin', label: 'Finnish' },
      ]);
    });
  });

  it('forwards selected values to onChangeLanguages', async () => {
    const onChangeLanguages = jest.fn();
    useLanguagesQuery.mockReturnValue({
      data: [
        { value: 'eng', label: 'English' },
        { value: 'fin', label: 'Finnish' },
      ],
      isLoading: false,
      isError: false,
    });

    render(
      <LanguageSelect
        onChangeLanguages={onChangeLanguages}
        preSelectedLanguages={['eng']}
      />,
    );

    await waitFor(() => {
      expect(asyncSelectProps.at(-1).onChange).toBeTruthy();
    });
    act(() => {
      asyncSelectProps.at(-1).onChange([
        { value: 'eng', label: 'English' },
        { value: 'fin', label: 'Finnish' },
      ]);
    });

    expect(onChangeLanguages).toHaveBeenCalledWith(['eng', 'fin']);
  });

  it('forwards an empty selection when onChange emits nothing', async () => {
    const onChangeLanguages = jest.fn();
    useLanguagesQuery.mockReturnValue({
      data: [{ value: 'eng', label: 'English' }],
      isLoading: false,
      isError: false,
    });

    render(<LanguageSelect onChangeLanguages={onChangeLanguages} />);

    await waitFor(() => {
      expect(asyncSelectProps.at(-1).onChange).toBeTruthy();
    });
    act(() => {
      asyncSelectProps.at(-1).onChange(null);
    });

    expect(onChangeLanguages).toHaveBeenCalledWith([]);
  });

  it('updates local selected state without an onChangeLanguages callback', async () => {
    useLanguagesQuery.mockReturnValue({
      data: [{ value: 'eng', label: 'English' }],
      isLoading: false,
      isError: false,
    });

    render(<LanguageSelect />);

    await waitFor(() => {
      expect(asyncSelectProps.at(-1).onChange).toBeTruthy();
    });
    act(() => {
      asyncSelectProps.at(-1).onChange([{ value: 'eng', label: 'English' }]);
    });

    await waitFor(() => {
      expect(asyncSelectProps.at(-1).value).toEqual([
        { value: 'eng', label: 'English' },
      ]);
    });
  });

  it('uses the translated placeholder by default', () => {
    useLanguagesQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    render(<LanguageSelect />);

    expect(screen.getByText('Select…')).toBeInTheDocument();
  });

  it('uses the translated loading message while languages are loading', async () => {
    useLanguagesQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<LanguageSelect />);

    await waitFor(() => {
      expect(asyncSelectProps.at(-1).loadingMessage()).toBe('Loading…');
    });
    expect(asyncSelectProps.at(-1).isLoading).toBe(true);
  });

  it('treats missing input as a short language search', async () => {
    useLanguagesQuery.mockReturnValue({
      data: [{ value: 'eng', label: 'English' }],
      isLoading: false,
      isError: false,
    });

    render(<LanguageSelect />);

    await waitFor(() => {
      expect(asyncSelectProps.at(-1).loadOptions).toBeTruthy();
    });

    expect(await asyncSelectProps.at(-1).loadOptions()).toEqual([]);
  });

  it('loads matching options only once input is long enough', async () => {
    useLanguagesQuery.mockReturnValue({
      data: [
        { value: 'eng', label: 'English' },
        { value: 'fin', label: 'Finnish' },
        { value: 'swe', label: 'Swedish' },
      ],
      isLoading: false,
      isError: false,
    });

    render(<LanguageSelect />);

    await waitFor(() => {
      expect(asyncSelectProps.at(-1).loadOptions).toBeTruthy();
    });
    const short = await asyncSelectProps.at(-1).loadOptions('E');
    const long = await asyncSelectProps.at(-1).loadOptions('Eng');

    expect(short).toEqual([]);
    expect(long).toEqual([{ value: 'eng', label: 'English' }]);
  });

  it('shows the right no-options message for short and long inputs', async () => {
    useLanguagesQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    render(<LanguageSelect />);

    await waitFor(() => {
      expect(asyncSelectProps.at(-1).noOptionsMessage).toBeTruthy();
    });

    expect(asyncSelectProps.at(-1).noOptionsMessage({ inputValue: 'E' })).toBe(
      'Start typing a language…',
    );
    expect(asyncSelectProps.at(-1).noOptionsMessage({ inputValue: 'En' })).toBe(
      'No languages found; try typing something else.',
    );
  });

  it('disables selector until language data is available', async () => {
    const makeQuery = value => ({
      data: value,
      isLoading: false,
      isError: false,
    });
    const props = [
      makeQuery(undefined),
      makeQuery([{ value: 'eng', label: 'English' }]),
    ];

    useLanguagesQuery
      .mockReturnValueOnce(props[0])
      .mockReturnValueOnce(props[1]);

    const { rerender } = render(<LanguageSelect />);

    await waitFor(() => {
      expect(asyncSelectProps.at(-1).isDisabled).toBe(true);
    });

    rerender(<LanguageSelect />);

    await waitFor(() => {
      expect(asyncSelectProps.at(-1).isDisabled).toBe(false);
    });
  });
});
