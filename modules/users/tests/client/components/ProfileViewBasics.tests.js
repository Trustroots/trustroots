import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ProfileViewBasics from '@/modules/users/client/components/ProfileViewBasics';

const baseProfile = {
  created: '2020-01-01T00:00:00.000Z',
  languages: [],
  seen: null,
};

describe('<ProfileViewBasics />', () => {
  it('renders reply stats from formatted API strings', () => {
    render(
      <ProfileViewBasics
        profile={{
          ...baseProfile,
          replyRate: '80%',
          replyTime: '3 hours',
        }}
      />,
    );

    expect(screen.getByText('Reply rate 80%.')).toBeInTheDocument();
    expect(screen.getByText('Replies within 3 hours.')).toBeInTheDocument();
  });

  it('renders zero reply rate without reply time', () => {
    render(
      <ProfileViewBasics
        profile={{
          ...baseProfile,
          replyRate: '0%',
          replyTime: '',
        }}
      />,
    );

    expect(screen.getByText('Reply rate 0%.')).toBeInTheDocument();
    expect(screen.queryByText(/^Replies within/)).not.toBeInTheDocument();
  });

  it('does not render reply stats when both values are empty', () => {
    render(
      <ProfileViewBasics
        profile={{
          ...baseProfile,
          replyRate: '',
          replyTime: '',
        }}
      />,
    );

    expect(screen.queryByText(/^Reply rate/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Replies within/)).not.toBeInTheDocument();
  });
});
