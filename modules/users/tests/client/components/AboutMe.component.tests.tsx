import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import { read as readCircles } from '@/modules/tribes/client/api/tribes.api';
import AboutMe from '@/modules/users/client/components/AboutMe.component';
import type { UserProfile } from '@/modules/users/client/types';

jest.mock('@/modules/tribes/client/api/tribes.api', () => ({
  read: jest.fn(),
}));

const readCirclesMock = jest.mocked(readCircles);

type AboutMeProfile = Pick<UserProfile, 'description'>;
const describedProfile: AboutMeProfile = {
  description:
    '<p>I host travelers, share meals, and like showing people around.</p>',
};

describe('<AboutMe />', () => {
  afterEach(() => readCirclesMock.mockReset());

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
    expect(readCirclesMock).not.toHaveBeenCalled();
  });

  it('links matching circle hashtags and keeps other text and formatting', async () => {
    const slugs = ['hackers', 'hitchhikers', 'musicians', 'remote-workers'];
    readCirclesMock.mockResolvedValue(
      slugs.map(slug => ({ _id: slug, slug, label: slug, count: 0 })),
    );
    render(
      <AboutMe
        isSelf={false}
        profile={{
          description:
            '<p><b>#hackers</b> #hitchhikers and #musicians very welcome. (#Remote-workers), #unknown, #hackerspace, https://example.org/#hackers <a href="/safety">Existing link</a></p>',
        }}
        profileMinimumLength={20}
      />,
    );

    await screen.findByRole('link', { name: '#hackers' });
    expect(readCirclesMock).toHaveBeenCalledWith({ limit: 0 });
    expect(screen.getAllByRole('link')).toHaveLength(4);
    for (const [index, name] of [
      '#hackers',
      '#hitchhikers',
      '#musicians',
      '#Remote-workers',
    ].entries()) {
      expect(screen.getByRole('link', { name })).toHaveAttribute(
        'href',
        `/circles/${slugs[index]}`,
      );
    }
    expect(
      screen.getByRole('link', { name: '#hackers' }).closest('b'),
    ).toBeInTheDocument();
    expect(screen.getByText(/#unknown, #hackerspace/)).toBeInTheDocument();
    expect(screen.getByText(/Existing link/)).toBeInTheDocument();
  });

  it('links complete hashtags in the preview and links the rest on expansion', async () => {
    readCirclesMock.mockResolvedValue(
      ['hackers', 'hackerspace'].map(slug => ({
        _id: slug,
        slug,
        label: slug,
        count: 0,
      })),
    );
    render(
      <AboutMe
        isSelf={false}
        profile={{
          description: `<p>#hackers ${'a'.repeat(1982)} #hackerspace</p>`,
        }}
        profileMinimumLength={20}
      />,
    );

    await screen.findByRole('link', { name: '#hackers' });
    expect(screen.getAllByRole('link')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Read more…' }));
    expect(screen.getByRole('link', { name: '#hackerspace' })).toHaveAttribute(
      'href',
      '/circles/hackerspace',
    );
  });

  it('keeps hashtags readable if the circle directory is unavailable', async () => {
    readCirclesMock.mockRejectedValue(new Error('Directory unavailable'));
    await act(async () => {
      render(
        <AboutMe
          isSelf={false}
          profile={{ description: '<p>Welcome, #hackers.</p>' }}
          profileMinimumLength={20}
        />,
      );
    });
    expect(screen.getByText('Welcome, #hackers.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('ignores directory results after the description stops containing hashtags', async () => {
    let resolveCircles!: (
      circles: Awaited<ReturnType<typeof readCircles>>,
    ) => void;
    readCirclesMock.mockReturnValue(
      new Promise(resolve => {
        resolveCircles = resolve;
      }),
    );
    const { rerender } = render(
      <AboutMe
        isSelf={false}
        profile={{ description: '<p>#hackers</p>' }}
        profileMinimumLength={20}
      />,
    );
    rerender(
      <AboutMe
        isSelf={false}
        profile={describedProfile}
        profileMinimumLength={20}
      />,
    );
    await act(async () => {
      resolveCircles([
        { _id: 'hackers', slug: 'hackers', label: 'Hackers', count: 0 },
      ]);
    });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
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
