import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import OfferRedirectPage, {
  defaultNavigate,
} from '@/modules/offers/client/components/OfferRedirectPage.component';

describe('OfferRedirectPage', () => {
  it('redirects to the host offer page on mount', () => {
    const navigate = jest.fn<void, [string]>();

    render(<OfferRedirectPage navigate={navigate} />);

    expect(navigate).toHaveBeenCalledWith('/offer/host');
    expect(screen.getByText('Redirecting…')).toBeInTheDocument();
  });

  it('provides a browser redirect fallback', () => {
    const replace = jest.fn<void, [string]>();

    defaultNavigate('/offer/host', { replace } as unknown as Location);

    expect(replace).toHaveBeenCalledWith('/offer/host');
  });
});
