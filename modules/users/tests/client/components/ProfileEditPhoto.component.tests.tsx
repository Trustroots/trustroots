import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';

import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import ProfileEditPhoto from '@/modules/users/client/components/ProfileEditPhoto.component';
import * as usersApi from '@/modules/users/client/api/users.api';
import type Avatar from '@/modules/users/client/components/Avatar.component';
import type { UserProfile } from '@/modules/users/client/types';

jest.mock('@/modules/users/client/api/users.api');
const updateUser = jest.mocked(usersApi.update);
const uploadAvatar = jest.mocked(usersApi.uploadAvatar);
jest.mock(
  '@/modules/users/client/components/ProfileEditPage.component',
  () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => (
      <section>{children}</section>
    ),
  }),
);
jest.mock('@/modules/users/client/components/Avatar.component', () => {
  function MockAvatar({
    user,
  }: Pick<React.ComponentProps<typeof Avatar>, 'user'>) {
    return <div data-testid="avatar">{user.username}</div>;
  }

  return MockAvatar;
});

const user: UserProfile = {
  _id: 'user-1',
  username: 'ada',
  displayName: 'Ada Example',
  avatarSource: 'gravatar',
  avatarUploaded: false,
};

function renderPage(overrides: Partial<UserProfile> = {}) {
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
        settings: { maxUploadSize: 5 * 1024 * 1024 },
        title: 'Trustroots',
        user: profile,
      }}
    >
      <ProfileEditPhoto user={profile} />
    </AppProviders>,
  );
}

function getFileInput(container: ParentNode = document): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Expected the avatar file input to render');
  }
  return input;
}

function mockFileReader(result: FileReader['result']): FileReader {
  const reader = new FileReader();
  Object.defineProperty(reader, 'result', {
    configurable: true,
    value: result,
  });
  jest.spyOn(reader, 'readAsDataURL').mockImplementation(() => {});
  jest.spyOn(window, 'FileReader').mockImplementation(() => reader);
  return reader;
}

function completeFileRead(reader: FileReader) {
  const event = new ProgressEvent('loadend');
  Object.defineProperty(event, 'target', { value: reader });
  reader.onloadend?.call(reader, event as ProgressEvent<FileReader>);
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

    const input = getFileInput();
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

  it.each(['image/png', ''])(
    'uploads a valid image with MIME %s and updates the profile',
    async type => {
      uploadAvatar.mockResolvedValue(undefined);
      updateUser.mockResolvedValue({
        ...user,
        avatarSource: 'local',
        avatarUploaded: true,
      });

      const fileReaderMock = mockFileReader('data:image/png;base64,abc');

      renderPage();

      const input = getFileInput();
      fireEvent.change(input, {
        target: {
          files: [new File(['data'], 'photo.png', { type })],
        },
      });

      completeFileRead(fileReaderMock);

      await waitFor(() => {
        expect(usersApi.uploadAvatar).toHaveBeenCalled();
      });
      expect(await screen.findByText('Profile photo updated.')).toBeVisible();
    },
  );

  it('continues the upload when FileReader returns a non-string result', async () => {
    uploadAvatar.mockResolvedValue(undefined);
    updateUser.mockResolvedValue({ ...user, avatarSource: 'local' });
    const fileReaderMock = mockFileReader(new ArrayBuffer(0));

    renderPage();
    fireEvent.change(getFileInput(), {
      target: {
        files: [new File(['data'], 'photo.png', { type: 'image/png' })],
      },
    });
    completeFileRead(fileReaderMock);

    await waitFor(() => expect(usersApi.uploadAvatar).toHaveBeenCalled());
  });

  it('shows a preview and progress while an image uploads', async () => {
    let resolveUpload!: () => void;
    uploadAvatar.mockReturnValue(
      new Promise<void>(resolve => {
        resolveUpload = resolve;
      }),
    );
    updateUser.mockResolvedValue({
      ...user,
      avatarSource: 'local',
      avatarUploaded: true,
    });
    const fileReaderMock = mockFileReader('data:image/png;base64,preview');

    const { container } = renderPage();
    fireEvent.change(getFileInput(container), {
      target: {
        files: [new File(['data'], 'photo.png', { type: 'image/png' })],
      },
    });

    await act(async () => {
      completeFileRead(fileReaderMock);
      await Promise.resolve();
    });

    expect(container.querySelector('.avatar-source-preview')).toHaveStyle(
      'background-image: url(data:image/png;base64,preview)',
    );
    expect(screen.getByText('Wait a moment…')).toBeVisible();

    await act(async () => {
      resolveUpload();
    });
    expect(await screen.findByText('Profile photo updated.')).toBeVisible();
  });

  it('switches avatar source to gravatar', async () => {
    updateUser.mockResolvedValue({ ...user, avatarSource: 'gravatar' });
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

    const input = getFileInput();
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

    const input = getFileInput();
    fireEvent.change(input, { target: { files: [] } });

    expect(usersApi.uploadAvatar).not.toHaveBeenCalled();
  });

  it('shows a server-side size error after upload failure', async () => {
    uploadAvatar.mockRejectedValue({ response: { status: 413 } });

    const fileReaderMock = mockFileReader('data:image/png;base64,abc');

    renderPage();

    const input = getFileInput();
    fireEvent.change(input, {
      target: {
        files: [new File(['data'], 'photo.png', { type: 'image/png' })],
      },
    });
    completeFileRead(fileReaderMock);

    expect(
      await screen.findByText(
        /Whoops, your file is too big. Please keep it up to/,
      ),
    ).toBeVisible();
  });

  it('shows a generic upload error message', async () => {
    uploadAvatar.mockRejectedValue(new Error('network'));

    const fileReaderMock = mockFileReader('data:image/png;base64,abc');

    renderPage();

    const input = getFileInput();
    fireEvent.change(input, {
      target: {
        files: [new File(['data'], 'photo.png', { type: 'image/png' })],
      },
    });
    completeFileRead(fileReaderMock);

    expect(
      await screen.findByText('Oops! Something went wrong. Try again later.'),
    ).toBeVisible();
  });

  it('shows a specific message when upload returns media-type error status', async () => {
    uploadAvatar.mockRejectedValue({
      response: { status: 415 },
    });

    const fileReaderMock = mockFileReader('data:image/png;base64,abc');

    renderPage();

    const input = getFileInput();
    fireEvent.change(input, {
      target: {
        files: [new File(['data'], 'photo.png', { type: 'image/png' })],
      },
    });
    completeFileRead(fileReaderMock);

    expect(
      await screen.findByText('Sorry, we do not support this type of file.'),
    ).toBeVisible();
  });

  it('handles update failures without a message', async () => {
    updateUser.mockRejectedValue(new Error('network'));
    renderPage({ avatarUploaded: true, avatarSource: 'local' });

    fireEvent.click(screen.getByLabelText('None'));

    expect(
      await screen.findByText('Oops! Something went wrong.'),
    ).toBeVisible();
  });

  it('reports avatar source save failures', async () => {
    updateUser.mockRejectedValue({
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

    const input = getFileInput();
    const click = jest.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Upload photo' }));
    fireEvent.click(screen.getByLabelText('My own'));
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
});
