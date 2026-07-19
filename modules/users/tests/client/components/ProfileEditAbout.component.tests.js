import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import ProfileEditAbout from '@/modules/users/client/components/ProfileEditAbout.component';
import * as usersApi from '@/modules/users/client/api/users.api';

jest.mock('@/modules/users/client/api/users.api');
jest.mock(
  '@/modules/users/client/components/ProfileEditPage.component',
  () => ({
    __esModule: true,
    default: ({ children }) => <section>{children}</section>,
  }),
);
jest.mock('@/modules/core/client/components/TrEditor', () => {
  const React = require('react');
  const PropTypes = require('prop-types');

  function MockTrEditor({ id, onChange, text }) {
    return (
      <textarea
        id={id}
        onChange={event => onChange(event.target.value)}
        value={text}
      />
    );
  }

  MockTrEditor.propTypes = {
    id: PropTypes.string,
    onChange: PropTypes.func,
    text: PropTypes.string,
  };

  return MockTrEditor;
});
jest.mock(
  '@/modules/users/client/components/ProfileEditLanguages.component',
  () => {
    const React = require('react');
    const PropTypes = require('prop-types');

    function MockProfileEditLanguages({ onChangeLanguages }) {
      return (
        <button type="button" onClick={() => onChangeLanguages(['en'])}>
          Edit languages
        </button>
      );
    }

    MockProfileEditLanguages.propTypes = {
      onChangeLanguages: PropTypes.func,
    };

    return MockProfileEditLanguages;
  },
);
jest.mock('@/modules/core/client/components/BirthdateSelect.component', () => {
  const React = require('react');
  const PropTypes = require('prop-types');

  function MockBirthdateSelect({ onChange, value }) {
    return (
      <input
        aria-label="Birthdate"
        onChange={event => onChange(event.target.value)}
        value={value || ''}
      />
    );
  }

  MockBirthdateSelect.propTypes = {
    onChange: PropTypes.func,
    value: PropTypes.string,
  };

  return MockBirthdateSelect;
});

const user = {
  _id: 'user-1',
  username: 'ada',
  firstName: 'Ada',
  lastName: 'Lovelace',
  description: '',
  languages: [],
};

function renderPage(overrides = {}, settings = { profileMinimumLength: 140 }) {
  const profile = { ...user, ...overrides };

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
    expect(screen.getByLabelText('Last name')).toHaveValue('Lovelace');
    expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeDisabled();
  });

  it('saves profile changes and shows confirmation', async () => {
    usersApi.update.mockResolvedValue({
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

  it('warns when the description is shorter than the minimum length', () => {
    renderPage({ description: 'Too short.' });

    expect(
      screen.getByText(
        'Write longer description in order to send messages to other members.',
      ),
    ).toBeInTheDocument();
  });

  it('updates languages through the languages editor', async () => {
    usersApi.update.mockResolvedValue({ ...user, languages: ['en'] });
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
    usersApi.update.mockRejectedValue({
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
    expect(screen.getByLabelText('Last name')).toHaveValue('');
    expect(screen.getByLabelText('Short tagline')).toHaveValue('');
  });

  it('uses a fallback message when profile saving has no response body', async () => {
    usersApi.update.mockRejectedValue(new Error('network'));
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
    fireEvent.change(screen.getByLabelText('Last name'), {
      target: { value: 'Hopper' },
    });
    fireEvent.change(screen.getByLabelText('Birthdate'), {
      target: { value: '1906-12-09' },
    });

    expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeEnabled();
  });
});
