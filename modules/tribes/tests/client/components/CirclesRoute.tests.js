import React from 'react';
import PropTypes from 'prop-types';
import '@testing-library/jest-dom/extend-expect';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import { useAuth } from '@/modules/core/client/react-app/auth';
import CirclesRoute from '@/modules/tribes/client/components/CirclesRoute';

jest.mock('@/modules/tribes/client/components/TribesPage.component', () => ({
  __esModule: true,
  default: ({ user, onMembershipUpdated }) => (
    <div>
      <p>Catalogue {user?.username}</p>
      <button
        onClick={() =>
          onMembershipUpdated({ user: { memberIds: ['circle-1'] } })
        }
      >
        Join
      </button>
      <button onClick={() => onMembershipUpdated({})}>Ignore</button>
    </div>
  ),
}));
jest.mock(
  '@/modules/tribes/client/components/TribeDetailPage.component',
  () => ({
    __esModule: true,
    default: ({ circle, onMembershipUpdated }) => (
      <div>
        <p>Circle {circle}</p>
        <button
          onClick={() => onMembershipUpdated({ user: { memberIds: [] } })}
        >
          Leave
        </button>
      </div>
    ),
  }),
);

function Page({ circle }) {
  const { user } = useAuth();
  return (
    <>
      <CirclesRoute user={user} circle={circle} />
      <output>{JSON.stringify(user)}</output>
    </>
  );
}
Page.propTypes = { circle: PropTypes.string };
function renderPage(
  circle,
  user = { username: 'samplemember', roles: ['welcome-team'], memberIds: [] },
) {
  return render(
    <AppProviders bootstrapData={{ user, settings: {} }}>
      <Page circle={circle} />
    </AppProviders>,
  );
}

describe('Circle route membership state', () => {
  afterEach(() => {
    delete window.user;
  });

  it('renders a catalogue for guests', () => {
    renderPage(undefined, null);
    expect(screen.getByText('Catalogue')).toBeInTheDocument();
  });
  it('retains the current account fields and roles after joining', () => {
    renderPage();
    fireEvent.click(screen.getByText('Join'));
    expect(window.user).toEqual({
      username: 'samplemember',
      roles: ['welcome-team'],
      memberIds: ['circle-1'],
    });
    expect(screen.getByRole('status')).toHaveTextContent('circle-1');
  });
  it('renders details and updates membership after leaving', () => {
    renderPage('sample-circle');
    expect(screen.getByText('Circle sample-circle')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Leave'));
    expect(window.user.roles).toEqual(['welcome-team']);
    expect(window.user.memberIds).toEqual([]);
  });
  it('ignores incomplete membership callbacks', () => {
    renderPage();
    fireEvent.click(screen.getByText('Ignore'));
    expect(window.user).toBeUndefined();
  });
});
