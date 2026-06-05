import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import LanguageList from '@/modules/users/client/components/LanguageList';
import { useLanguagesQuery } from '@/modules/core/client/api/languages.api';

jest.mock('@/modules/core/client/api/languages.api');

afterEach(() => {
  jest.clearAllMocks();
});

describe('<LanguageList />', () => {
  it('renders nothing while loading or without language codes', () => {
    useLanguagesQuery.mockReturnValue({ data: {}, isLoading: true });

    const { container, rerender } = render(
      <LanguageList languages={['eng']} className="languages" />,
    );
    expect(container).toBeEmptyDOMElement();

    useLanguagesQuery.mockReturnValue({
      data: { eng: 'English' },
      isLoading: false,
    });

    rerender(<LanguageList languages={[]} className="languages" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders translated language names and falls back to unknown codes', () => {
    useLanguagesQuery.mockReturnValue({
      data: {
        eng: 'English',
      },
      isLoading: false,
    });

    render(<LanguageList languages={['eng', 'zzz']} className="languages" />);

    expect(screen.getByRole('list')).toHaveClass('languages');
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('zzz')).toBeInTheDocument();
  });
});
