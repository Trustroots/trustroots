import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import ProfileOverview from '@/modules/users/client/components/ProfileOverview.component';

jest.mock('@/modules/users/client/components/Avatar.component', () => {
  function MockAvatar({ onClick, size, user }) {
    return (
      <button data-testid={`avatar-${size}`} onClick={onClick} type="button">
        {`Avatar ${size} ${user.displayName}`}
      </button>
    );
  }

  MockAvatar.propTypes = {
    onClick: () => null,
    size: () => null,
    user: () => null,
  };

  return MockAvatar;
});

jest.mock('@/modules/users/client/components/ProfileViewBasics', () => {
  function MockProfileViewBasics({ profile }) {
    return (
      <section data-testid="profile-basics">{profile.displayName}</section>
    );
  }

  MockProfileViewBasics.propTypes = {
    profile: () => null,
  };

  return MockProfileViewBasics;
});

describe('<ProfileOverview />', () => {
  const profile = {
    avatarSource: 'none',
    displayName: 'Alice Example',
    username: 'alice',
  };

  it('renders profile basics and opens the large avatar modal', async () => {
    render(<ProfileOverview profile={profile} />);

    expect(screen.getByTestId('profile-basics')).toHaveTextContent(
      'Alice Example',
    );
    expect(screen.getByTestId('avatar-256')).toHaveTextContent(
      'Avatar 256 Alice Example',
    );

    fireEvent.click(screen.getByTestId('avatar-256'));

    expect(await screen.findByTestId('avatar-512')).toHaveTextContent(
      'Avatar 512 Alice Example',
    );

    fireEvent.click(screen.getByTestId('avatar-512'));

    await waitFor(() =>
      expect(screen.queryByTestId('avatar-512')).not.toBeInTheDocument(),
    );
  });
});
