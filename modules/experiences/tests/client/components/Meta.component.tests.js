import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Meta from '@/modules/experiences/client/components/read-experiences/Meta';

describe('<Meta />', () => {
  it('renders a recommend label and interaction labels', () => {
    render(
      <Meta
        recommend="yes"
        interactions={{ guest: true, host: false, met: true }}
      />,
    );

    expect(screen.getByText('Recommend')).toBeInTheDocument();
    expect(screen.getByText('Guest')).toBeInTheDocument();
    expect(screen.getByText('Met in person')).toBeInTheDocument();
    expect(screen.queryByText('Host')).not.toBeInTheDocument();
    expect(screen.queryByText('Not recommend')).not.toBeInTheDocument();
  });

  it('renders a negative recommend label', () => {
    render(<Meta recommend="no" interactions={{ host: true }} />);

    expect(screen.getByText('Not recommend')).toBeInTheDocument();
    expect(screen.getByText('Host')).toBeInTheDocument();
  });

  it('renders nothing when there are no labels', () => {
    const { container } = render(
      <Meta recommend="unknown" interactions={{}} />,
    );

    expect(container.querySelectorAll('.label')).toHaveLength(0);
  });
});
