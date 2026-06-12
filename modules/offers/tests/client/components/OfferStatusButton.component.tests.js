import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import OfferStatusButton from '@/modules/offers/client/components/OfferStatusButton';

describe('<OfferStatusButton />', () => {
  it('links the owner to their own offer editor', () => {
    render(<OfferStatusButton isOwnOffer status="yes" username="alice" />);

    const link = screen.getByRole('link', { name: 'Can host' });
    expect(link).toHaveAttribute('href', '/offer/host');
    expect(link).toHaveClass('btn-offer-hosting-yes');
  });

  it('links other members to a message with the host', () => {
    render(
      <OfferStatusButton isOwnOffer={false} status="maybe" username="alice" />,
    );

    const link = screen.getByRole('link', {
      name: 'Might be able to host',
    });
    expect(link).toHaveAttribute('href', '/messages/alice');
    expect(link).toHaveClass('btn-offer-hosting-maybe');
  });

  it('shows the cannot-host state when there is no status', () => {
    render(<OfferStatusButton isOwnOffer={false} username="alice" />);

    const link = screen.getByRole('link', {
      name: 'Cannot host currently',
    });
    expect(link).toHaveClass('btn-offer-hosting-no');
  });
});
