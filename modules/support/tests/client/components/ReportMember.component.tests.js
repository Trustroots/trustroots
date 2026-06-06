import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import ReportMember from '@/modules/support/client/components/ReportMember.component';

describe('<ReportMember />', () => {
  it('returns null if username is not provided', () => {
    const { container } = render(<ReportMember />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders support link with supplied username and className', () => {
    render(<ReportMember className="support-link" username="alice" />);

    const link = screen.getByRole('link', {
      name: 'Report member alice to support',
    });

    expect(link).toHaveAttribute('href', '/support?report=alice');
    expect(link).toHaveClass('support-link');
    expect(link).toHaveTextContent('Report member');
  });
});
