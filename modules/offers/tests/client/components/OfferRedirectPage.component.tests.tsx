import React from 'react';
import { render, screen } from '@testing-library/react';

import OfferRedirectPage, {
  defaultNavigate,
} from '@/modules/offers/client/components/OfferRedirectPage.component';

describe('OfferRedirectPage', () => {
  it('redirects to the host offer page on mount', () => {
    const navigate = vi.fn<(...args: [string]) => void>();

    render(<OfferRedirectPage navigate={navigate} />);

    expect(navigate).toHaveBeenCalledWith('/offer/host');
    expect(screen.getByText('Redirecting…')).toBeInTheDocument();
  });

  it('provides a browser redirect fallback', () => {
    const replace = vi.fn<(...args: [string]) => void>();

    Reflect.apply(defaultNavigate, undefined, ['/offer/host', { replace }]);

    expect(replace).toHaveBeenCalledWith('/offer/host');
  });
});
