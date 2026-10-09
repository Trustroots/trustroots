import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ReportMember from '@/modules/support/client/components/ReportMember.component';

type ReportMemberProps = React.ComponentProps<typeof ReportMember>;
const sampleMember: NonNullable<ReportMemberProps['username']> =
  'sample-member';

describe('<ReportMember />', () => {
  it('returns null if username is not provided', () => {
    const { container } = render(<ReportMember />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders support link with supplied username and className', () => {
    render(<ReportMember className="support-link" username={sampleMember} />);

    const link = screen.getByRole('link', {
      name: 'Report member sample-member to support',
    });

    expect(link).toHaveAttribute('href', '/support?report=sample-member');
    expect(link).toHaveClass('support-link');
    expect(link).toHaveTextContent('Report member to support');
  });
});
