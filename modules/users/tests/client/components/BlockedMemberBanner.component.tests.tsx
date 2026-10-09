import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import '@/config/client/i18n';
import BlockedMemberBanner from '@/modules/users/client/components/BlockedMemberBanner.component';
import type BlockMember from '@/modules/users/client/components/BlockMember.component';

type ReportMemberProps = { username: string; className?: string };
type BlockMemberProps = React.ComponentProps<typeof BlockMember>;

const mockReportMemberCalls: ReportMemberProps[] = [];
const mockBlockMemberCalls: BlockMemberProps[] = [];

jest.mock(
  '@/modules/support/client/components/ReportMember.component.js',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');

    function MockReportMember(props: ReportMemberProps) {
      mockReportMemberCalls.push(props);

      return React.createElement(
        'a',
        {
          'data-testid': 'report-member-link',
          'data-username': props.username,
        },
        'Report',
      );
    }

    return MockReportMember;
  },
);

jest.mock('@/modules/users/client/components/BlockMember.component.js', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockBlockMember(props: BlockMemberProps) {
    mockBlockMemberCalls.push(props);

    return React.createElement(
      'button',
      {
        'data-testid': 'block-member-button',
        'data-username': props.username,
      },
      'Block/Unblock',
    );
  }

  return MockBlockMember;
});

describe('<BlockedMemberBanner />', function () {
  beforeEach(function () {
    mockReportMemberCalls.length = 0;
    mockBlockMemberCalls.length = 0;
  });

  it('renders blocked-message actions with injected username', function () {
    render(<BlockedMemberBanner username="alice" />);

    expect(
      screen.getByText(content =>
        content.includes('You have blocked this member.'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(content =>
        content.includes('They cannot see or message you.'),
      ),
    ).toBeInTheDocument();

    const report = screen.getByTestId('report-member-link');
    const block = screen.getByTestId('block-member-button');

    expect(report).toHaveAttribute('data-username', 'alice');
    expect(block).toHaveAttribute('data-username', 'alice');
    expect(mockReportMemberCalls[0]).toMatchObject({
      username: 'alice',
      className: 'btn btn-link',
    });
    expect(mockBlockMemberCalls[0]).toMatchObject({
      username: 'alice',
      isBlocked: true,
      className: 'btn btn-link',
    });
  });
});
