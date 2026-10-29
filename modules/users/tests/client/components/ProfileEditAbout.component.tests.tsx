import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AppProviders } from '@/layers/shell/client/AppProviders';
import ProfileEditAbout from '@/modules/users/client/components/ProfileEditAbout.component';
import * as usersApi from '@/modules/users/client/api/users.api';
import type TrEditor from '@/modules/core/client/components/TrEditor';
import type BirthdateSelect from '@/modules/core/client/components/BirthdateSelect.component';
import type ProfileEditLanguages from '@/modules/users/client/components/ProfileEditLanguages.component';
import type { UserProfile } from '@/modules/users/client/types';

jest.mock('@/modules/users/client/api/users.api');
const updateUser = jest.mocked(usersApi.update);
jest.mock(
  '@/modules/users/client/components/ProfileEditPage.component',
  () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => (
      <section>{children}</section>
    ),
  }),
);
jest.mock('@/modules/core/client/components/TrEditor', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockTrEditor({
    id,
    onChange,
    text,
  }: Pick<React.ComponentProps<typeof TrEditor>, 'id' | 'onChange' | 'text'>) {
    return (
      <textarea
        id={id}
        onChange={event => onChange(event.target.value)}
        value={text}
      />
    );
  }

  return MockTrEditor;
});
jest.mock(
  '@/modules/users/client/components/ProfileEditLanguages.component',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');

    function MockProfileEditLanguages({
      onChangeLanguages,
      onChangeLevels,
    }: React.ComponentProps<typeof ProfileEditLanguages>) {
      return (
        <>
          <button type="button" onClick={() => onChangeLanguages(['en'])}>
            Edit languages
          </button>
          <button
            type="button"
            onClick={() => onChangeLevels?.({ en: 'native' })}
          >
            Edit language levels
          </button>
        </>
      );
    }

    return MockProfileEditLanguages;
  },
);
jest.mock('@/modules/core/client/components/BirthdateSelect.component', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockBirthdateSelect({
    onChange,
    value,
  }: React.ComponentProps<typeof BirthdateSelect>) {
    return (
      <input
        aria-label="Birthdate"
        onChange={event => onChange(event.target.value)}
        value={value || ''}
      />
    );
  }

  return MockBirthdateSelect;
});

const user: UserProfile = {
  _id: 'user-1',
  username: 'ada',
  displayName: 'Ada Example',
  firstName: 'Ada',
  lastName: 'Lovelace',
  description: '',
  languages: [],
};

function renderPage(
  overrides: Partial<UserProfile> = {},
  settings: NonNullable<Window['settings']> = { profileMinimumLength: 140 },
) {
  const profile: UserProfile = {
    ...user,
    ...overrides,
    _id: user._id,
    username: user.username,
    displayName: user.displayName,
  };

  return render(
    <AppProviders
      bootstrapData={{
        env: 'test',
        isNativeMobileApp: false,
        settings,
        title: 'Trustroots',
        user: profile,
      }}
    >
      <ProfileEditAbout user={profile} />
    </AppProviders>,
  );
}

describe('ProfileEditAbout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders profile edit fields and keeps save disabled until changed', () => {
    renderPage();

    expect(screen.getByLabelText('First name')).toHaveValue('Ada');
    expect(screen.getByLabelText('Last name (optional)')).toHaveValue(
      'Lovelace',
    );
    expect(
      screen.getByLabelText('Last name (optional)'),
    ).toHaveAccessibleDescription(
      'You can use a nickname. You don’t need to share your full name.',
    );
    expect(
      screen.getByText(
        'You can use a nickname. You don’t need to share your full name.',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeDisabled();
  });

  it('saves profile changes and shows confirmation', async () => {
    updateUser.mockResolvedValue({
      ...user,
      tagline: 'Traveller and mathematician',
    });
    renderPage();

    fireEvent.change(screen.getByLabelText('Short tagline'), {
      target: { value: 'Traveller and mathematician' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

    await waitFor(() => {
      expect(usersApi.update).toHaveBeenCalledWith(
        expect.objectContaining({ tagline: 'Traveller and mathematician' }),
      );
    });
    expect(await screen.findByText('Profile updated.')).toBeVisible();
  });

  it('saves a cleared last name for an existing profile', async () => {
    updateUser.mockResolvedValue({ ...user, lastName: '' });
    renderPage();

    fireEvent.change(screen.getByLabelText('Last name (optional)'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

    await waitFor(() => {
      expect(usersApi.update).toHaveBeenCalledWith(
        expect.objectContaining({ lastName: '' }),
      );
    });
  });

  it('warns when the description is shorter than the minimum length', () => {
    renderPage({ description: 'Too short.' });

    expect(
      screen.getByText(
        'Write longer description in order to send messages to other members.',
      ),
    ).toBeInTheDocument();
  });

  it('updates languages through the languages editor', async () => {
    updateUser.mockResolvedValue({ ...user, languages: ['en'] });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Edit languages' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

    await waitFor(() => {
      expect(usersApi.update).toHaveBeenCalledWith(
        expect.objectContaining({ languages: ['en'] }),
      );
    });
  });

  it('reports save failures', async () => {
    updateUser.mockRejectedValue({
      response: { data: { message: 'Unable to save profile.' } },
    });
    renderPage();

    fireEvent.change(screen.getByLabelText('Short tagline'), {
      target: { value: 'Updated tagline' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

    expect(await screen.findByText('Unable to save profile.')).toBeVisible();
  });

  it('uses default settings and blank values for incomplete profiles', () => {
    renderPage(
      {
        description: undefined,
        firstName: undefined,
        languages: undefined,
        lastName: undefined,
        tagline: undefined,
      },
      {},
    );

    expect(screen.getByLabelText('Describe Yourself')).toHaveValue('');
    expect(screen.getByLabelText('First name')).toHaveValue('');
    expect(screen.getByLabelText('Last name (optional)')).toHaveValue('');
    expect(screen.getByLabelText('Short tagline')).toHaveValue('');
  });

  it('uses a fallback message when profile saving has no response body', async () => {
    updateUser.mockRejectedValue(new Error('network'));
    renderPage();

    fireEvent.change(screen.getByLabelText('Short tagline'), {
      target: { value: 'Updated tagline' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

    expect(
      await screen.findByText('Something went wrong. Please try again!'),
    ).toBeVisible();
  });

  it('enables save after editing the description', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Describe Yourself'), {
      target: { value: 'A longer personal description.' },
    });

    expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeEnabled();
  });

  it('tracks draft changes from basic profile fields', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('I Am'), {
      target: { value: 'female' },
    });

    expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeEnabled();
  });

  it('tracks first name, last name, and birthdate changes', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('First name'), {
      target: { value: 'Grace' },
    });
    fireEvent.change(screen.getByLabelText('Last name (optional)'), {
      target: { value: 'Hopper' },
    });
    fireEvent.change(screen.getByLabelText('Birthdate'), {
      target: { value: '1906-12-09' },
    });

    expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeEnabled();
  });
});

it('saves language levels with the profile draft', async () => {
  updateUser.mockResolvedValue({
    ...user,
    languages: ['en'],
    languageLevels: { en: 'native' },
  });
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Edit languages' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit language levels' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
  await waitFor(() =>
    expect(updateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        languages: ['en'],
        languageLevels: { en: 'native' },
      }),
    ),
  );
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Profile updated.',
  );
});
