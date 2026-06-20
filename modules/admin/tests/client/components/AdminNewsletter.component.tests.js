import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import AdminNewsletter from '@/modules/admin/client/components/AdminNewsletter.component';

describe('<AdminNewsletter />', () => {
  it('shows newsletter placeholder state', () => {
    render(<AdminNewsletter />);

    expect(screen.getByText('Newsletter subscribers')).toBeInTheDocument();
    expect(screen.getByText('Work in progress.')).toBeInTheDocument();
  });
});
