import React, { type PropsWithChildren } from 'react';
import { render, screen } from '@testing-library/react';

import '@/config/client/i18n';
import { Route } from '@/layers/shell/client/routes/safety';
import { useAuth } from '@trustroots/core/auth';
import Safety from '@/modules/pages/client/components/Safety.component';
import { recordSafetyPageVisit } from '@/modules/users/client/api/users.api';

vi.mock('@trustroots/core/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/modules/users/client/api/users.api', () => ({
  recordSafetyPageVisit: vi.fn(),
}));

vi.mock('@/modules/core/client/components/Board', async () => {
  const actualReact = await vi.importActual<typeof import('react')>('react');
  function MockBoard({ children }: PropsWithChildren) {
    return actualReact.createElement('div', null, children);
  }

  return { default: MockBoard };
});

describe('<Safety />', () => {
  it('renders practical safety guidance and key support links', () => {
    render(<Safety />);
    expect(
      screen.getByRole('heading', {
        name: 'Protect Your Identity and Payment Details',
        level: 3,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Asking for payment breaks our community rules. Never share credit card details with other members. We discourage hosts and guests from requesting ID or passports. If you agree to a check, do it in person and avoid making or keeping digital copies.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'An ID request alone does not break our community rules.',
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: 'Safety Tips for Trustroots' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Before You Meet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Safety page contents' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Before You Meet' }),
    ).toHaveAttribute('href', '#before-you-meet');
    expect(
      screen.getByRole('link', { name: 'Community Safety' }),
    ).toHaveAttribute('href', '#community-safety');
    expect(screen.getByRole('link', { name: 'Emergencies' })).toHaveAttribute(
      'href',
      '#emergencies',
    );
    expect(
      screen.getByRole('link', { name: 'Help Us Build a Safer Community' }),
    ).toHaveAttribute('href', '#help-build-a-safer-community');
    expect(
      screen.getByRole('heading', { name: 'Emergencies' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Sharing an Experience' }),
    ).toHaveTextContent(/Leave out home addresses, personal contact details/);
    expect(
      screen.getByText(/becomes public when both of you have shared/),
    ).toHaveTextContent('after 14 days');
    expect(
      screen.getByRole('heading', {
        name: 'Women Travellers and Gender Minorities',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/contact local emergency services first/i),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /contact|send us/i })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: expect.stringContaining('/support'),
        }),
      ]),
    );
    expect(
      screen.getByRole('link', {
        name: 'show accountability and make amends',
      }),
    ).toHaveAttribute('href', 'https://team.trustroots.org/accountability/');
    expect(
      screen.getByRole('link', {
        name: 'show accountability and make amends',
      }),
    ).toHaveAttribute('target', '_blank');
  });
});

describe('Safety route visit recording', () => {
  const SafetyPage = Route.options.component!;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(recordSafetyPageVisit).mockResolvedValue(undefined);
  });

  function setMember(user: ReturnType<typeof useAuth>['user']) {
    vi.mocked(useAuth).mockReturnValue({
      user,
      isAuthenticated: Boolean(user),
      setUser: vi.fn(),
      hasRole: vi.fn(),
      signOut: vi.fn(),
    });
  }

  it('renders the guidance for visitors without recording a visit', () => {
    setMember(null);
    render(<SafetyPage />);
    expect(
      screen.getByRole('heading', { name: 'Safety Tips for Trustroots' }),
    ).toBeVisible();
    expect(recordSafetyPageVisit).not.toHaveBeenCalled();
  });

  it('records a member visit without blocking the guidance on failure', async () => {
    setMember({ _id: 'member-id' });
    vi.mocked(recordSafetyPageVisit).mockRejectedValueOnce(
      new Error('Offline'),
    );
    render(<SafetyPage />);
    expect(
      await screen.findByRole('heading', {
        name: 'Safety Tips for Trustroots',
      }),
    ).toBeVisible();
    expect(recordSafetyPageVisit).toHaveBeenCalledOnce();
  });
});
