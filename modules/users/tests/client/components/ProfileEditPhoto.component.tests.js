import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import ProfileEditPhoto, {
  bytesToSize,
} from '@/modules/users/client/components/ProfileEditPhoto.component';
import * as usersApi from '@/modules/users/client/api/users.api';

jest.mock('@/modules/users/client/api/users.api');
jest.mock(
  '@/modules/users/client/components/ProfileEditPage.component',
  () => ({
    __esModule: true,
    default: ({ children }) => <section>{children}</section>,
  }),
);
jest.mock('@/modules/users/client/components/Avatar.component', () => {
  const React = require('react');
  const PropTypes = require('prop-types');

  function MockAvatar({ user }) {
    return <div data-testid="avatar">{user.username}</div>;
  }

  MockAvatar.propTypes = {
    user: PropTypes.object.isRequired,
  };

  return MockAvatar;
});

const user = {
  _id: 'user-1',
  username: 'ada',
  avatarSource: 'gravatar',
  avatarUploaded: false,
};

function renderPage(overrides = {}) {
  const profile = { ...user, ...overrides };

  return render(
    <AppProviders
      bootstrapData={{
        env: 'test',
        isNativeMobileApp: false,
        settings: { maxUploadSize: 5 * 1024 * 1024 },
        title: 'Trustroots',
        user: profile,
      }}
    >
      <ProfileEditPhoto user={profile} />
    </AppProviders>,
  );
}

describe('ProfileEditPhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders upload and avatar source options', () => {
    renderPage({ avatarUploaded: true, avatarSource: 'local' });

    expect(screen.getByRole('button', { name: 'Upload photo' })).toBeVisible();
    expect(screen.getByLabelText('My own')).toBeChecked();
    expect(screen.getByLabelText('Gravatar')).toBeInTheDocument();
    expect(screen.getByLabelText('None')).toBeInTheDocument();
  });

  it('rejects unsupported file types', () => {
    renderPage();

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, {
      target: {
        files: [new File(['data'], 'photo.webp', { type: 'image/webp' })],
      },
    });

    expect(
      screen.getByText('Please give a jpg, gif, or png image.'),
    ).toBeVisible();
    expect(usersApi.uploadAvatar).not.toHaveBeenCalled();
  });

  it('uploads a valid image and updates the profile', async () => {
    usersApi.uploadAvatar.mockResolvedValue({});
    usersApi.update.mockResolvedValue({
      ...user,
      avatarSource: 'local',
      avatarUploaded: true,
    });

    const fileReaderMock = {
      readAsDataURL: jest.fn(),
      onloadend: null,
      result: 'data:image/png;base64,abc',
    };
    jest.spyOn(window, 'FileReader').mockImplementation(() => fileReaderMock);

    renderPage();

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, {
      target: {
        files: [new File(['data'], 'photo.png', { type: 'image/png' })],
      },
    });

    fileReaderMock.onloadend();

    await waitFor(() => {
      expect(usersApi.uploadAvatar).toHaveBeenCalled();
    });
    expect(await screen.findByText('Profile photo updated.')).toBeVisible();
  });

  it('switches avatar source to gravatar', async () => {
    usersApi.update.mockResolvedValue({ ...user, avatarSource: 'gravatar' });
    renderPage({ avatarUploaded: true, avatarSource: 'local' });

    fireEvent.click(screen.getByLabelText('Gravatar'));

    await waitFor(() => {
      expect(usersApi.update).toHaveBeenCalledWith(
        expect.objectContaining({ avatarSource: 'gravatar' }),
      );
    });
    expect(await screen.findByText('Profile photo updated.')).toBeVisible();
  });

  it('rejects files that exceed the upload limit', () => {
    renderPage();

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, {
      target: {
        files: [
          new File(['x'.repeat(6 * 1024 * 1024)], 'huge.png', {
            type: 'image/png',
          }),
        ],
      },
    });

    expect(
      screen.getByText(/Whoops, your file is too big. Please keep it up to/),
    ).toBeVisible();
    expect(usersApi.uploadAvatar).not.toHaveBeenCalled();
  });

  it('ignores empty file selections', () => {
    renderPage();

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [] } });

    expect(usersApi.uploadAvatar).not.toHaveBeenCalled();
  });

  it('shows a server-side size error after upload failure', async () => {
    usersApi.uploadAvatar.mockRejectedValue({ response: { status: 413 } });

    const fileReaderMock = {
      readAsDataURL: jest.fn(),
      onloadend: null,
      result: 'data:image/png;base64,abc',
    };
    jest.spyOn(window, 'FileReader').mockImplementation(() => fileReaderMock);

    renderPage();

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, {
      target: {
        files: [new File(['data'], 'photo.png', { type: 'image/png' })],
      },
    });
    fileReaderMock.onloadend();

    expect(
      await screen.findByText(
        /Whoops, your file is too big. Please keep it up to/,
      ),
    ).toBeVisible();
  });

  it('shows a generic upload error message', async () => {
    usersApi.uploadAvatar.mockRejectedValue(new Error('network'));

    const fileReaderMock = {
      readAsDataURL: jest.fn(),
      onloadend: null,
      result: 'data:image/png;base64,abc',
    };
    jest.spyOn(window, 'FileReader').mockImplementation(() => fileReaderMock);

    renderPage();

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, {
      target: {
        files: [new File(['data'], 'photo.png', { type: 'image/png' })],
      },
    });
    fileReaderMock.onloadend();

    expect(
      await screen.findByText('Oops! Something went wrong. Try again later.'),
    ).toBeVisible();
  });

  it('shows a specific message when upload returns media-type error status', async () => {
    usersApi.uploadAvatar.mockRejectedValue({
      response: { status: 415 },
    });

    const fileReaderMock = {
      readAsDataURL: jest.fn(),
      onloadend: null,
      result: 'data:image/png;base64,abc',
    };
    jest.spyOn(window, 'FileReader').mockImplementation(() => fileReaderMock);

    renderPage();

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, {
      target: {
        files: [new File(['data'], 'photo.png', { type: 'image/png' })],
      },
    });
    fileReaderMock.onloadend();

    expect(
      await screen.findByText('Sorry, we do not support this type of file.'),
    ).toBeVisible();
  });

  it('handles update failures without a message', async () => {
    usersApi.update.mockRejectedValue(new Error('network'));
    renderPage({ avatarUploaded: true, avatarSource: 'local' });

    fireEvent.click(screen.getByLabelText('None'));

    expect(
      await screen.findByText('Oops! Something went wrong.'),
    ).toBeVisible();
  });

  it('reports avatar source save failures', async () => {
    usersApi.update.mockRejectedValue({
      response: { data: { message: 'Unable to save avatar source.' } },
    });
    renderPage({ avatarUploaded: true, avatarSource: 'local' });

    fireEvent.click(screen.getByLabelText('None'));

    expect(
      await screen.findByText('Unable to save avatar source.'),
    ).toBeVisible();
  });

  it('opens the file picker and handles an empty-sized file', () => {
    renderPage({ avatarUploaded: true, avatarSource: 'gravatar' });

    const input = document.querySelector('input[type="file"]');
    const click = jest.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Upload photo' }));
    fireEvent.click(screen.getByLabelText('My own'));
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('formats zero-byte files', () => {
    expect(bytesToSize(0)).toBe('0 Byte');
  });
});
