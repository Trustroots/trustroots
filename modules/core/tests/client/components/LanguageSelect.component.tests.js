import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import LanguageSelect from '@/modules/core/client/components/LanguageSelect';
import { useLanguagesQuery } from '@/modules/core/client/api/languages.api';

jest.mock('@/modules/core/client/api/languages.api');

afterEach(() => {
  jest.clearAllMocks();
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
});
