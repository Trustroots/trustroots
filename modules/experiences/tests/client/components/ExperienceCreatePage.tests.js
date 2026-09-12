import React from 'react';
import '@testing-library/jest-dom/extend-expect';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import '@/config/client/i18n';
import ExperienceCreatePage from '@/modules/experiences/client/components/ExperienceCreatePage';
import { useSettings } from '@/modules/core/client/react-app/AppProviders';
import { fetch as fetchProfile } from '@/modules/users/client/api/users.api';
import CreateExperience from '@/modules/experiences/client/components/CreateExperience.component';

jest.mock('@/modules/core/client/react-app/AppProviders');
jest.mock('@/modules/users/client/api/users.api');
jest.mock(
  '@/modules/users/client/components/Avatar.component',
  () => () => null,
);
jest.mock(
  '@/modules/experiences/client/components/CreateExperience.component',
  () => jest.fn(() => <div>Experience form</div>),
);

const user = { _id: 'sample-author' };
const profile = {
  _id: 'sample-recipient',
  username: 'samplemember',
  displayName: 'Sample Member',
};
function renderPage() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ExperienceCreatePage user={user} username="samplemember" />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  useSettings.mockReturnValue({ referencesEnabled: true });
  fetchProfile.mockResolvedValue(profile);
});
it('loads the recipient and passes both members to the existing experience form', async () => {
  renderPage();
  expect(await screen.findByText('Experience form')).toBeVisible();
  expect(fetchProfile).toHaveBeenCalledWith('samplemember');
  expect(CreateExperience).toHaveBeenCalledWith(
    { userFrom: user, userTo: profile },
    {},
  );
  expect(screen.getByRole('link')).toHaveAttribute(
    'href',
    '/profile/samplemember',
  );
});
it('does not load or offer a form when experiences are disabled', () => {
  useSettings.mockReturnValue({ referencesEnabled: false });
  renderPage();
  expect(fetchProfile).not.toHaveBeenCalled();
  expect(screen.queryByText('Experience form')).not.toBeInTheDocument();
});
it('reports recipient loading failures without offering a form', async () => {
  fetchProfile.mockRejectedValue(new Error('unavailable'));
  renderPage();
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.queryByText('Experience form')).not.toBeInTheDocument();
});
it('waits for the profile before mounting the form', async () => {
  let resolveProfile;
  fetchProfile.mockReturnValue(
    new Promise(resolve => {
      resolveProfile = resolve;
    }),
  );
  renderPage();
  expect(screen.queryByText('Experience form')).not.toBeInTheDocument();
  await waitFor(() => expect(fetchProfile).toHaveBeenCalled());
  resolveProfile(profile);
  expect(await screen.findByText('Experience form')).toBeVisible();
});
