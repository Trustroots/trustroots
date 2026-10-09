import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import AboutMe from '@/modules/users/client/components/AboutMe.component';
import type { UserProfile } from '@/modules/users/client/types';

type AboutMeProfile = Pick<UserProfile, 'description'>;
const describedProfile: AboutMeProfile = {
  description:
    '<p>I host travelers, share meals, and like showing people around.</p>',
};

describe('<AboutMe />', () => {
  it('renders the profile description without the completion prompt', () => {
    render(
      <AboutMe isSelf profile={describedProfile} profileMinimumLength={20} />,
    );

    expect(
      screen.getByText(
        'I host travelers, share meals, and like showing people around.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Your profile description should be longer so that you can send messages.',
      ),
    ).not.toBeInTheDocument();
  });

  it('prompts the current member to complete a missing description', () => {
    const profile: AboutMeProfile = {};
    render(<AboutMe isSelf profile={profile} profileMinimumLength={20} />);

    expect(
      screen.getByLabelText(
        'Member has not written description about themself.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your profile description should be longer so that you can send messages.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Fill your profile' }),
    ).toHaveAttribute('href', '/profile/edit');
  });

  it("does not prompt visitors to fill someone else's profile", () => {
    const profile: AboutMeProfile = {};
    render(
      <AboutMe isSelf={false} profile={profile} profileMinimumLength={20} />,
    );

    expect(
      screen.queryByText(
        'Your profile description should be longer so that you can send messages.',
      ),
    ).not.toBeInTheDocument();
  });
});
