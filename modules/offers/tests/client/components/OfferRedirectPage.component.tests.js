import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import OfferRedirectPage, {
  defaultNavigate,
} from '@/modules/offers/client/components/OfferRedirectPage.component';

describe('OfferRedirectPage', () => {
  it('redirects to the host offer page on mount', () => {
    const navigate = jest.fn();

    render(<OfferRedirectPage navigate={navigate} />);

    expect(navigate).toHaveBeenCalledWith('/offer/host');
    expect(screen.getByText('Redirecting…')).toBeInTheDocument();
  });

  it('provides a browser redirect fallback', () => {
    const replace = jest.fn();

    defaultNavigate('/offer/host', { replace });

    expect(replace).toHaveBeenCalledWith('/offer/host');
  });
});
