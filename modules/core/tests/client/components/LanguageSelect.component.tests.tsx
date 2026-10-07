import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { UseQueryResult } from 'react-query';

import '@/config/client/i18n';
import LanguageSelect from '@/modules/core/client/components/LanguageSelect';
import {
  useLanguagesQuery,
  type LanguageOption,
} from '@/modules/core/client/api/languages.api';

type CapturedAsyncSelectProps = {
  placeholder?: React.ReactNode;
  value?: LanguageOption[];
  isLoading?: boolean;
  isDisabled?: boolean;
  loadOptions?: (inputValue?: string) => Promise<LanguageOption[]>;
  onChange?: (value: LanguageOption[] | null) => void;
  loadingMessage?: () => string;
  noOptionsMessage?: (args: { inputValue: string }) => string;
};

const asyncSelectProps: CapturedAsyncSelectProps[] = [];
const useLanguagesQueryMock = useLanguagesQuery as jest.MockedFunction<
  typeof useLanguagesQuery
>;

jest.mock('react-select/async', () => {
  return function MockAsyncSelect(props: CapturedAsyncSelectProps) {
    asyncSelectProps.push(props);
    return (
      <div>
        <div>{props.placeholder}</div>
      </div>
    );
  };
});

jest.mock('@/modules/core/client/api/languages.api');

afterEach(() => {
  jest.clearAllMocks();
  asyncSelectProps.length = 0;
});

function latestSelectProps(): CapturedAsyncSelectProps {
  const props = asyncSelectProps[asyncSelectProps.length - 1];
  if (!props) {
    throw new Error('AsyncSelect was not rendered');
  }
  return props;
}

function mockLanguagesQuery(
  partial: Partial<UseQueryResult<LanguageOption[], unknown>> & {
    data?: LanguageOption[] | undefined;
    isLoading: boolean;
    isError: boolean;
  },
) {
  useLanguagesQueryMock.mockReturnValue(
    partial as UseQueryResult<LanguageOption[], unknown>,
  );
}

describe('<LanguageSelect />', () => {
  it('renders the select once languages are loaded', () => {
    mockLanguagesQuery({
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

  it('shows an error alert when languages fail to load', async () => {
    mockLanguagesQuery({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<LanguageSelect />);

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    await expect(latestSelectProps().loadOptions!('English')).resolves.toEqual(
      [],
    );
  });

  it('prefills selected languages from preSelectedLanguages', async () => {
    mockLanguagesQuery({
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
      expect(latestSelectProps().value).toEqual([
        { value: 'eng', label: 'English' },
        { value: 'fin', label: 'Finnish' },
      ]);
    });
  });

  it('retains a deprecated selection without offering it in search', async () => {
    const existing: LanguageOption = {
      value: 'enm',
      label: 'Middle English (1100-1500)',
      deprecated: true,
    };
    const selectable: LanguageOption = {
      value: 'eng',
      label: 'English',
      deprecated: false,
    };
    mockLanguagesQuery({
      data: [existing, selectable],
      isLoading: false,
      isError: false,
    });

    render(<LanguageSelect excludeDeprecated preSelectedLanguages={['enm']} />);

    await waitFor(() => {
      expect(latestSelectProps().value).toEqual([existing]);
    });
    expect(await latestSelectProps().loadOptions!('Middle')).toEqual([]);
    expect(await latestSelectProps().loadOptions!('English')).toEqual([
      selectable,
    ]);
  });

  it('offers deprecated languages when used as a search filter', async () => {
    const historical: LanguageOption = {
      value: 'enm',
      label: 'Middle English (1100-1500)',
      deprecated: true,
    };
    mockLanguagesQuery({
      data: [historical],
      isLoading: false,
      isError: false,
    });

    render(<LanguageSelect />);

    expect(await latestSelectProps().loadOptions!('Middle')).toEqual([
      historical,
    ]);
  });

  it('forwards selected values to onChangeLanguages', async () => {
    const onChangeLanguages = jest.fn();
    mockLanguagesQuery({
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
      expect(latestSelectProps().onChange).toBeTruthy();
    });
    act(() => {
      latestSelectProps().onChange?.([
        { value: 'eng', label: 'English' },
        { value: 'fin', label: 'Finnish' },
      ]);
    });

    expect(onChangeLanguages).toHaveBeenCalledWith(['eng', 'fin']);
  });

  it('forwards an empty selection when onChange emits nothing', async () => {
    const onChangeLanguages = jest.fn();
    mockLanguagesQuery({
      data: [{ value: 'eng', label: 'English' }],
      isLoading: false,
      isError: false,
    });

    render(<LanguageSelect onChangeLanguages={onChangeLanguages} />);

    await waitFor(() => {
      expect(latestSelectProps().onChange).toBeTruthy();
    });
    act(() => {
      latestSelectProps().onChange?.(null);
    });

    expect(onChangeLanguages).toHaveBeenCalledWith([]);
  });

  it('updates local selected state without an onChangeLanguages callback', async () => {
    mockLanguagesQuery({
      data: [{ value: 'eng', label: 'English' }],
      isLoading: false,
      isError: false,
    });

    render(<LanguageSelect />);

    await waitFor(() => {
      expect(latestSelectProps().onChange).toBeTruthy();
    });
    act(() => {
      latestSelectProps().onChange?.([{ value: 'eng', label: 'English' }]);
    });

    await waitFor(() => {
      expect(latestSelectProps().value).toEqual([
        { value: 'eng', label: 'English' },
      ]);
    });
  });

  it('uses the translated placeholder by default', () => {
    mockLanguagesQuery({
      data: [] as LanguageOption[],
      isLoading: false,
      isError: false,
    });

    render(<LanguageSelect />);

    expect(screen.getByText('Select…')).toBeInTheDocument();
  });

  it('uses the translated loading message while languages are loading', async () => {
    mockLanguagesQuery({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<LanguageSelect />);

    await waitFor(() => {
      expect(latestSelectProps().loadingMessage?.()).toBe('Loading…');
    });
    expect(latestSelectProps().isLoading).toBe(true);
  });

  it('treats missing input as a short language search', async () => {
    mockLanguagesQuery({
      data: [{ value: 'eng', label: 'English' }],
      isLoading: false,
      isError: false,
    });

    render(<LanguageSelect />);

    await waitFor(() => {
      expect(latestSelectProps().loadOptions).toBeTruthy();
    });

    expect(await latestSelectProps().loadOptions!()).toEqual([]);
  });

  it('loads matching options only once input is long enough', async () => {
    mockLanguagesQuery({
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
      expect(latestSelectProps().loadOptions).toBeTruthy();
    });
    const short = await latestSelectProps().loadOptions!('E');
    const long = await latestSelectProps().loadOptions!('Eng');

    expect(short).toEqual([]);
    expect(long).toEqual([{ value: 'eng', label: 'English' }]);
  });

  it('matches language labels without requiring accents', async () => {
    mockLanguagesQuery({
      data: [
        { value: 'rcf', label: 'Réunion Creole French' },
        { value: 'fin', label: 'Finnish' },
      ],
      isLoading: false,
      isError: false,
    });

    render(<LanguageSelect />);

    await waitFor(() => {
      expect(latestSelectProps().loadOptions).toBeTruthy();
    });

    expect(await latestSelectProps().loadOptions!('reunion')).toEqual([
      { value: 'rcf', label: 'Réunion Creole French' },
    ]);
  });

  it('shows the right no-options message for short and long inputs', async () => {
    mockLanguagesQuery({
      data: [] as LanguageOption[],
      isLoading: false,
      isError: false,
    });

    render(<LanguageSelect />);

    await waitFor(() => {
      expect(latestSelectProps().noOptionsMessage).toBeTruthy();
    });

    expect(latestSelectProps().noOptionsMessage!({ inputValue: 'E' })).toBe(
      'Start typing a language…',
    );
    expect(latestSelectProps().noOptionsMessage!({ inputValue: 'En' })).toBe(
      'No languages found; try typing something else.',
    );
  });

  it('disables selector until language data is available', async () => {
    useLanguagesQueryMock
      .mockReturnValueOnce({
        data: undefined,
        isLoading: false,
        isError: false,
      } as UseQueryResult<LanguageOption[], unknown>)
      .mockReturnValueOnce({
        data: [{ value: 'eng', label: 'English' }],
        isLoading: false,
        isError: false,
      } as UseQueryResult<LanguageOption[], unknown>);

    const { rerender } = render(<LanguageSelect />);

    await waitFor(() => {
      expect(latestSelectProps().isDisabled).toBe(true);
    });

    rerender(<LanguageSelect />);

    await waitFor(() => {
      expect(latestSelectProps().isDisabled).toBe(false);
    });
  });
});
