import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import Stat from '@/modules/statistics/client/components/Stat';

describe('<Stat />', () => {
  it('renders its title and children', () => {
    render(
      <Stat title="Members" className="custom-class">
        <span>1234</span>
      </Stat>,
    );

    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
  });

  it('applies panel classes and any extra className', () => {
    const { container } = render(
      <Stat title="Members" className="custom-class">
        <span>1234</span>
      </Stat>,
    );

    const panel = container.firstChild;
    expect(panel).toHaveClass('panel');
    expect(panel).toHaveClass('panel-default');
    expect(panel).toHaveClass('custom-class');
  });
});
