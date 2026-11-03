import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { readOutreachSource } from '@trustroots/analytics/client';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import OfferStatusButton from '@/modules/offers/client/components/OfferStatusButton';

describe('<OfferStatusButton />', () => {
  it('links the owner to their own offer editor', () => {
    render(<OfferStatusButton isOwnOffer status="yes" username="alice" />);

    const link = screen.getByRole('link', { name: 'Can host' });
    expect(link).toHaveAttribute('href', '/offer/host');
    expect(link).toHaveAttribute('data-intent', 'success');
  });

  it('links other members to a message with the host', () => {
    render(
      <OfferStatusButton isOwnOffer={false} status="maybe" username="alice" />,
    );

    const link = screen.getByRole('link', {
      name: 'Might be able to host',
    });
    expect(link).toHaveAttribute('href', '/messages/alice');
    expect(link).toHaveAttribute('data-intent', 'warning');

    link.addEventListener('click', event => event.preventDefault());
    fireEvent.click(link);
    expect(readOutreachSource('alice')).toBe('offer');
    window.sessionStorage.clear();
  });

  it('shows the cannot-host state when there is no status', () => {
    render(<OfferStatusButton isOwnOffer={false} username="alice" />);

    const link = screen.getByRole('link', {
      name: 'Cannot host currently',
    });
    expect(link).toHaveAttribute('data-intent', 'danger');
  });
});
