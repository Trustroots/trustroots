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

describe('circle form feedback and fields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getCircles.mockResolvedValue([]);
  });

  it('reports catalogue loading errors', async () => {
    getCircles.mockRejectedValueOnce(new Error('Unavailable'));
    render(<AdminCircles />);
    expect(await screen.findByText('Could not load circles.')).toBeVisible();
  });

  it('edits visibility, optional metadata and the image', async () => {
    const circle = {
      _id: 'circle-hidden',
      label: 'Walkers',
      public: false,
      image: true,
      slug: 'walkers',
      color: '345d5c',
      description: 'A circle',
      attribution: 'Example artist',
      attribution_url: 'https://example.org',
    };
    getCircles.mockResolvedValue([circle]);
    saveCircle.mockResolvedValue(circle);
    render(<AdminCircles />);
    fireEvent.click(
      await screen.findByRole('button', { name: /Walkers Hidden/ }),
    );
    expect(screen.getByAltText('Current circle')).toHaveAttribute(
      'src',
      '/uploads-circle/walkers/120x120.jpg',
    );
    fireEvent.click(screen.getByLabelText('Public'));
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Updated circle' },
    });
    const image = new File(['image'], 'circle.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Image'), {
      target: { files: [image] },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save circle' }).closest('form'),
    );
    expect(await screen.findByText('Circle saved.')).toBeVisible();
    expect(saveCircle).toHaveBeenCalledWith(
      { ...circle, public: true, description: 'Updated circle' },
      image,
    );
    fireEvent.click(screen.getByRole('button', { name: 'New circle' }));
    expect(screen.queryByText('Circle saved.')).not.toBeInTheDocument();
    expect(screen.queryByAltText('Current circle')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it.each([
    [new Error('Unavailable'), 'Could not save circle.'],
    [{ response: {} }, 'Could not save circle.'],
    [{ response: { data: {} } }, 'Could not save circle.'],
    [
      { response: { data: { message: 'Name already exists.' } } },
      'Name already exists.',
    ],
  ])('reports save errors (%#)', async (error, message) => {
    saveCircle.mockRejectedValueOnce(error);
    render(<AdminCircles />);
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save circle' }).closest('form'),
    );
    expect(await screen.findByText(message)).toBeVisible();
  });
});
