import React, { type PropsWithChildren } from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import Media from '@/modules/pages/client/components/Media.component';

jest.mock('@/modules/core/client/components/Board.js', () => {
  const actualReact = jest.requireActual<typeof import('react')>('react');
  function MockBoard({ children }: PropsWithChildren) {
    return actualReact.createElement('div', null, children);
  }
  return MockBoard;
});

describe('<Media />', () => {
  it('renders the media page headings and links', () => {
    render(<Media />);

    expect(screen.getByText('Trustroots in Media')).toBeInTheDocument();
    expect(screen.getByText('Interviews')).toBeInTheDocument();
    expect(screen.getByText('Fact sheet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'PNG' })).toHaveAttribute(
      'href',
      'https://raw.githubusercontent.com/Trustroots/community/master/media/logo/logo.png',
    );
    expect(screen.getByRole('link', { name: 'Style guide' })).toHaveAttribute(
      'href',
      'https://github.com/Trustroots/community/blob/master/media/style-guide/Trustroots-Styleguide.pdf',
    );
    expect(screen.getByRole('link', { name: 'Screenshots' })).toHaveAttribute(
      'href',
      'https://github.com/Trustroots/community/tree/master/media/screenshots',
    );
  });
});
