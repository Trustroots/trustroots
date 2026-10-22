import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import LanguageList from '@/modules/users/client/components/LanguageList';
import { useLanguagesQuery } from '@/modules/core/client/api/languages.api';

const useLanguagesQueryMock = jest.mocked(useLanguagesQuery);

function queryResult(
  data: Record<string, string> | undefined,
  isLoading: boolean,
): ReturnType<typeof useLanguagesQuery> {
  const base = {
    dataUpdatedAt: 0,
    error: null,
    errorUpdatedAt: 0,
    failureCount: 0,
    errorUpdateCount: 0,
    failureReason: null,
    isError: false,
    isFetched: false,
    isFetchedAfterMount: false,
    isFetching: false,
    isInitialLoading: false,
    isLoadingError: false,
    isPaused: false,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    fetchStatus: 'idle',
    refetch: async () => queryResult(data, isLoading),
  };
  const result = isLoading
    ? {
        ...base,
        data: undefined,
        isLoading: true,
        isPending: true,
        isSuccess: false,
        status: 'pending',
      }
    : {
        ...base,
        data: data ?? {},
        isLoading: false,
        isPending: false,
        isSuccess: true,
        status: 'success',
      };
  return result as unknown as ReturnType<typeof useLanguagesQuery>;
}

jest.mock('@/modules/core/client/api/languages.api');

afterEach(() => {
  jest.clearAllMocks();
});

describe('<LanguageList />', () => {
  it('renders nothing while loading or without language codes', () => {
    useLanguagesQueryMock.mockReturnValue(queryResult({}, true));

    const { container, rerender } = render(
      <LanguageList languages={['eng']} className="languages" />,
    );
    expect(container).toBeEmptyDOMElement();

    useLanguagesQueryMock.mockReturnValue(
      queryResult({ eng: 'English' }, false),
    );

    rerender(<LanguageList languages={[]} className="languages" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders translated language names and falls back to unknown codes', () => {
    useLanguagesQueryMock.mockReturnValue(
      queryResult({ eng: 'English' }, false),
    );

    render(<LanguageList languages={['eng', 'zzz']} className="languages" />);

    expect(screen.getByRole('list')).toHaveClass('languages');
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('zzz')).toBeInTheDocument();
  });

  it('emphasises only languages listed in emphasisedLanguages', () => {
    useLanguagesQueryMock.mockReturnValue(
      queryResult({ eng: 'English', fre: 'French', spa: 'Spanish' }, false),
    );

    render(
      <LanguageList
        languages={['eng', 'fre', 'spa']}
        emphasisedLanguages={['fre']}
      />,
    );

    const items = screen.getByRole('list').children;
    expect(items[0]).toHaveTextContent('English');
    expect(items[0].querySelector('strong')).toBeNull();
    expect(items[1].querySelector('strong')).toHaveTextContent('French');
    expect(items[2].querySelector('strong')).toBeNull();
  });

  it('renders nothing when language codes are omitted', () => {
    useLanguagesQueryMock.mockReturnValue(
      queryResult({ eng: 'English' }, false),
    );

    const { container } = render(<LanguageList className="languages" />);

    expect(container).toBeEmptyDOMElement();
  });
});

it('shows levels beside languages and leaves unspecified levels blank', () => {
  useLanguagesQueryMock.mockReturnValue(
    queryResult({ eng: 'English', fra: 'French' }, false),
  );
  render(
    <LanguageList
      languages={['eng', 'fra']}
      languageLevels={{ eng: 'advanced' }}
    />,
  );
  expect(screen.getByText('English — Advanced')).toBeInTheDocument();
  expect(screen.getByText('French')).toBeInTheDocument();
});
