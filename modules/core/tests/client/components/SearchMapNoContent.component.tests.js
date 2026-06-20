import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import SearchMapNoContent from '@/modules/search/client/components/SearchMapNoContent';

describe('<SearchMapNoContent />', () => {
  it('shows a translated hint and icon when no map results are shown', () => {
    const { container } = render(<SearchMapNoContent />);

    expect(
      screen.getByText('Zoom closer to find members.'),
    ).toBeInTheDocument();
    expect(container.querySelector('.icon-users')).toBeInTheDocument();
  });
});
