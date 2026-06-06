import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import '@/config/client/i18n';
import BlockedMemberBanner from '@/modules/users/client/components/BlockedMemberBanner.component';

const reportMemberCalls = [];
const blockMemberCalls = [];

jest.mock(
  '@/modules/support/client/components/ReportMember.component.js',
  () => {
    const React = require('react');
    const PropTypes = require('prop-types');

    function MockReportMember(props) {
      reportMemberCalls.push(props);

      return React.createElement(
        'a',
        {
          'data-testid': 'report-member-link',
          'data-username': props.username,
        },
        'Report',
      );
    }

    MockReportMember.propTypes = {
      username: PropTypes.string,
    };

    return MockReportMember;
  },
);

jest.mock('@/modules/users/client/components/BlockMember.component.js', () => {
  const React = require('react');
  const PropTypes = require('prop-types');

  function MockBlockMember(props) {
    blockMemberCalls.push(props);

    return React.createElement(
      'button',
      {
        'data-testid': 'block-member-button',
        'data-username': props.username,
      },
      'Block/Unblock',
    );
  }

  MockBlockMember.propTypes = {
    username: PropTypes.string,
  };

  return MockBlockMember;
});

describe('<BlockedMemberBanner />', function () {
  beforeEach(function () {
    reportMemberCalls.length = 0;
    blockMemberCalls.length = 0;
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
    expect(reportMemberCalls[0]).toMatchObject({
      username: 'alice',
      className: 'btn btn-link',
    });
    expect(blockMemberCalls[0]).toMatchObject({
      username: 'alice',
      isBlocked: true,
      className: 'btn btn-link',
    });
  });
});
