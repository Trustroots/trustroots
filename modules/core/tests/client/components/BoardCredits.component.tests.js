import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import BoardCredits from '@/modules/core/client/components/BoardCredits';

jest.mock('@/modules/core/client/services/angular-compat', () => ({
  $on: jest.fn(() => () => {}),
}));

describe('<BoardCredits />', () => {
  it('renders nothing when there are no credits', () => {
    const { container } = render(<BoardCredits photoCredits={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a single photo credit', () => {
    render(
      <BoardCredits
        photoCredits={{
          bokeh: { name: 'Alice', url: 'https://example.com/alice' },
        }}
      />,
    );

    expect(screen.getByText('Photo by')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute(
      'href',
      'https://example.com/alice',
    );
  });

  it('renders multiple photo credits with license links', () => {
    render(
      <BoardCredits
        photoCredits={{
          a: { name: 'Alice', url: 'https://example.com/a' },
          b: {
            name: 'Bob',
            url: 'https://example.com/b',
            license: 'CC-BY',
            license_url: 'https://example.com/license',
          },
        }}
      />,
    );

    expect(screen.getByText('Photos by')).toBeInTheDocument();
    expect(screen.getByText('CC-BY')).toBeInTheDocument();
  });
});
