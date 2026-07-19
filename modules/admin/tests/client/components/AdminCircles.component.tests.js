import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import AdminCircles from '@/modules/admin/client/components/AdminCircles.component';
import { getCircles, saveCircle } from '@/modules/admin/client/api/circles.api';

jest.mock('@/modules/admin/client/api/circles.api');

describe('<AdminCircles />', () => {
  beforeEach(() => {
    getCircles.mockResolvedValue([
      {
        _id: 'circle-id',
        label: 'Hikers',
        count: 4,
        public: true,
        image: false,
      },
    ]);
    saveCircle.mockResolvedValue({
      _id: 'circle-id',
      label: 'Hikers',
      count: 4,
      public: true,
      image: false,
    });
  });

  it('loads circles and lets an administrator edit one', async () => {
    render(<AdminCircles />);
    expect(
      await screen.findByRole('button', { name: /hikers/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hikers/i }));
    expect(screen.getByLabelText('Name')).toHaveValue('Hikers');
  });

  it('submits a new circle', async () => {
    render(<AdminCircles />);
    fireEvent.click(screen.getByRole('button', { name: 'New circle' }));
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Cyclists' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save circle' }).closest('form'),
    );
    await waitFor(() => expect(saveCircle).toHaveBeenCalled());
    expect(saveCircle.mock.calls[0][0].label).toBe('Cyclists');
  });
});
