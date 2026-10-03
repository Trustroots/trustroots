import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import qrcode from 'qrcode-generator';
import NostrootsOnboarding from '@/modules/core/client/components/NostrootsOnboarding.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => key.replace('{{username}}', options?.username),
  }),
}));

jest.mock('qrcode-generator', () =>
  jest.fn(() => ({
    addData: jest.fn(),
    make: jest.fn(),
    createDataURL: jest.fn(() => 'data:image/gif;base64,local-qr'),
  })),
);

describe('Nostroots onboarding action', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shares the exact link with the local QR encoder and updates both on username changes', () => {
    const { rerender } = render(
      <NostrootsOnboarding username="sampleviewer" source="network-settings" />,
    );
    const link = screen.getByRole('link', { name: 'Continue in Nostroots' });
    const image = screen.getByRole('img', {
      name: 'Scan to continue in Nostroots on your phone',
    });
    const qr = qrcode.mock.results[0].value;

    expect(link).toHaveAttribute(
      'href',
      'https://nos.trustroots.org/open/onboarding?username=sampleviewer',
    );
    expect(link).not.toHaveAttribute('target');
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(qr.addData).toHaveBeenCalledWith(link.getAttribute('href'));
    expect(qr.make).toHaveBeenCalledTimes(1);
    expect(qr.createDataURL).toHaveBeenCalledWith(4);
    expect(image).toHaveAttribute('src', 'data:image/gif;base64,local-qr');
    expect(
      screen.getByText('Your username will be filled in: sampleviewer.'),
    ).toBeInTheDocument();

    rerender(
      <NostrootsOnboarding
        username="anothermember"
        source="network-settings"
      />,
    );
    expect(link).toHaveAttribute(
      'href',
      'https://nos.trustroots.org/open/onboarding?username=anothermember',
    );
    expect(qrcode.mock.results[1].value.addData).toHaveBeenCalledWith(
      link.getAttribute('href'),
    );

    rerender(<NostrootsOnboarding source="network-settings" />);
    expect(link).toHaveAttribute(
      'href',
      'https://nos.trustroots.org/open/onboarding',
    );
    expect(qrcode.mock.results[2].value.addData).toHaveBeenCalledWith(
      link.getAttribute('href'),
    );
    expect(
      screen.queryByText(/Your username will be filled in/),
    ).not.toBeInTheDocument();
  });

  it.each(['community-notes', 'profile-notes', 'network-settings'])(
    'labels %s clicks without including identity in analytics properties',
    source => {
      render(<NostrootsOnboarding username="sampleviewer" source={source} />);
      const link = screen.getByRole('link', { name: 'Continue in Nostroots' });
      const analytics = [...link.attributes]
        .filter(attribute => attribute.name.startsWith('data-umami-'))
        .map(attribute => [attribute.name, attribute.value]);
      expect(analytics).toEqual([
        ['data-umami-event', 'nostroots-onboarding'],
        ['data-umami-event-source', source],
      ]);
    },
  );

  it('explains account setup and reopening the original link after installation', () => {
    render(<NostrootsOnboarding source="network-settings" />);
    expect(
      screen.getByText(
        'This opens account setup in Nostroots. It does not sign you in automatically.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'If you need to install the app, return to this page and open the link again afterwards.',
      ),
    ).toBeInTheDocument();
  });
});
