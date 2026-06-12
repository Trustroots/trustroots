import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Experience from '@/modules/experiences/client/components/read-experiences/Experience';

const userFrom = {
  _id: 'user-from',
  username: 'alice',
  displayName: 'Alice Example',
  gender: 'female',
  created: '2019-01-01T00:00:00.000Z',
};

const userTo = {
  _id: 'user-to',
  username: 'bob',
  displayName: 'Bob Example',
};

describe('<Experience />', () => {
  it('renders a public experience with feedback and a response', () => {
    render(
      <Experience
        onReceiverProfile={false}
        experience={{
          _id: 'experience-1',
          created: '2020-01-01T00:00:00.000Z',
          feedbackPublic: 'Lovely person to host.',
          interactions: { guest: false, host: true, met: true },
          public: true,
          recommend: 'yes',
          userFrom,
          userTo,
          response: {
            _id: 'response-1',
            created: '2020-01-02T00:00:00.000Z',
            feedbackPublic: 'Thanks, was great!',
            interactions: { guest: true, host: false, met: true },
            recommend: 'yes',
          },
        }}
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Alice Example' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Lovely person to host.')).toBeInTheDocument();
    expect(screen.getByText('Thanks, was great!')).toBeInTheDocument();
    expect(screen.getAllByText('Recommend').length).toBeGreaterThan(0);
  });

  it('renders a pending notice for a not-yet-public experience', () => {
    render(
      <Experience
        onReceiverProfile={true}
        experience={{
          _id: 'experience-2',
          created: new Date().toISOString(),
          feedbackPublic: '',
          interactions: { guest: false, host: false, met: true },
          public: false,
          recommend: 'yes',
          userFrom,
          userTo,
          response: null,
        }}
      />,
    );

    expect(
      screen.getByText(/Your experience will become public in/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Write about your experience with them'),
    ).not.toBeInTheDocument();
  });

  it('renders receiver pending notice without profile metadata or response feedback', () => {
    render(
      <Experience
        onReceiverProfile={false}
        experience={{
          _id: 'experience-2b',
          created: new Date().toISOString(),
          feedbackPublic: undefined,
          interactions: { guest: true, host: false, met: false },
          public: false,
          recommend: 'no',
          userFrom: {
            _id: 'anonymous-from',
            displayName: 'Anonymous From',
            avatarSource: 'none',
          },
          userTo,
          response: {
            _id: 'response-2b',
            created: new Date().toISOString(),
            interactions: { guest: false, host: true, met: false },
            recommend: 'no',
          },
        }}
      />,
    );

    expect(
      screen.getByText(
        /You have .* days left to respond before their experience will become public/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Write about your experience with them'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Member since/)).not.toBeInTheDocument();
  });

  it('shows a reply call-to-action while waiting for the receiver response', () => {
    render(
      <Experience
        onReceiverProfile={false}
        experience={{
          _id: 'experience-2c',
          created: new Date().toISOString(),
          feedbackPublic: undefined,
          interactions: { guest: true, host: false, met: false },
          public: false,
          recommend: 'yes',
          userFrom,
          userTo,
          response: null,
        }}
      />,
    );

    expect(
      screen.getByRole('link', {
        name: 'Write about your experience with them',
      }),
    ).toHaveAttribute('href', '/profile/alice/experiences/new');
  });

  it('shows a write-experience footer on the receiver profile for public experiences', () => {
    render(
      <Experience
        onReceiverProfile={true}
        experience={{
          _id: 'experience-3',
          created: '2020-01-01T00:00:00.000Z',
          feedbackPublic: '',
          interactions: { guest: false, host: false, met: true },
          public: true,
          recommend: 'yes',
          userFrom,
          userTo,
          response: null,
        }}
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Write about your experience' }),
    ).toHaveAttribute('href', '/profile/alice/experiences/new');
  });
});
