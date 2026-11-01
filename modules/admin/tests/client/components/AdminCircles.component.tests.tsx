import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminCircles from '@/modules/admin/client/components/AdminCircles.component';
import { getCircles, saveCircle } from '@/modules/admin/client/api/circles.api';

jest.mock('@/modules/core/client/react-app/auth', () =>
  jest.requireActual('@/testutils/client/auth.testutil').mockAuthModule(),
);
jest.mock('@tanstack/react-router', () =>
  jest.requireActual('@/testutils/client/router-location.testutil'),
);

jest.mock('@/modules/admin/client/api/circles.api');

const getCirclesMock = jest.mocked(getCircles);
const saveCircleMock = jest.mocked(saveCircle);

type CircleFixture = {
  _id?: string;
  label: string;
  count?: number;
  public: boolean;
  image?: boolean;
  slug?: string;
  color?: string;
  description?: string;
  attribution?: string;
  attribution_url?: string;
};

describe('<AdminCircles />', () => {
  beforeEach(() => {
    getCirclesMock.mockResolvedValue([
      {
        _id: 'circle-id',
        label: 'Hikers',
        count: 4,
        public: true,
        image: false,
      },
    ] as CircleFixture[]);
    saveCircleMock.mockResolvedValue({
      _id: 'circle-id',
      label: 'Hikers',
      count: 4,
      public: true,
      image: false,
    } as CircleFixture);
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
      screen.getByRole('button', { name: 'Save circle' }).closest('form')!,
    );
    await waitFor(() => expect(saveCircleMock).toHaveBeenCalled());
    expect((saveCircleMock.mock.calls[0][0] as CircleFixture).label).toBe(
      'Cyclists',
    );
  });
});

describe('circle editor navigation and preview', () => {
  const selected = {
    _id: 'walkers-id',
    slug: 'walkers',
    label: 'Walkers',
    public: true,
  };
  beforeEach(() => {
    jest.clearAllMocks();
    getCirclesMock.mockResolvedValue([selected]);
  });

  it.each([false, true])(
    'ignores catalogue completion after unmount (failure: %s)',
    async fails => {
      let complete: () => void = () => undefined;
      getCirclesMock.mockReturnValue(
        new Promise((resolve, reject) => {
          complete = () =>
            fails ? reject(new Error('Unavailable')) : resolve([selected]);
        }),
      );
      const { unmount } = render(<AdminCircles circleSlug="walkers" />);
      unmount();
      await act(async () => {
        complete();
      });
    },
  );

  it('loads a slug directly, links to its public page and returns to a new circle', async () => {
    const onNavigate = jest.fn();
    const { rerender } = render(
      <AdminCircles circleSlug="walkers" onNavigate={onNavigate} />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Name')).toHaveValue('Walkers'),
    );
    expect(screen.getByRole('link', { name: 'View circle' })).toHaveAttribute(
      'href',
      '/circles/walkers',
    );
    fireEvent.click(screen.getByRole('button', { name: 'New circle' }));
    expect(onNavigate).toHaveBeenCalledWith('/admin/circles');
    fireEvent.click(screen.getByRole('button', { name: 'Walkers' }));
    expect(onNavigate).toHaveBeenCalledWith('/admin/circles/walkers');
    rerender(<AdminCircles circleSlug="missing" onNavigate={onNavigate} />);
    expect(await screen.findByText('Circle not found.')).toBeVisible();
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('previews safe links and formatting while editing', async () => {
    render(<AdminCircles />);
    await screen.findByRole('button', { name: 'Walkers' });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: {
        value:
          '<p><strong>Walk together</strong> <a href="https://example.org/walks">Routes</a><script>bad()</script><a href="javascript:bad()">Bad link</a></p>',
      },
    });
    const preview = screen.getByRole('region', { name: 'Description preview' });
    expect(within(preview).getByText('Walk together').tagName).toBe('STRONG');
    expect(
      within(preview).getByRole('link', { name: 'Routes' }),
    ).toHaveAttribute('href', 'https://example.org/walks');
    expect(within(preview).getByText('Bad link')).not.toHaveAttribute('href');
    expect(preview.querySelector('script')).toBeNull();
  });

  it('navigates to the created circle after saving', async () => {
    const onNavigate = jest.fn();
    saveCircleMock.mockResolvedValue(selected);
    render(<AdminCircles onNavigate={onNavigate} />);
    await screen.findByRole('button', { name: 'Walkers' });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save circle' }).closest('form')!,
    );
    await waitFor(() =>
      expect(onNavigate).toHaveBeenCalledWith('/admin/circles/walkers'),
    );
  });
});

describe('circle form feedback and fields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getCirclesMock.mockResolvedValue([]);
  });

  it('reports catalogue loading errors', async () => {
    getCirclesMock.mockRejectedValueOnce(new Error('Unavailable'));
    render(<AdminCircles />);
    expect(await screen.findByText('Could not load circles.')).toBeVisible();
  });

  it('edits visibility, optional metadata and the image', async () => {
    const circle: CircleFixture = {
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
    getCirclesMock.mockResolvedValue([circle]);
    const saved = {
      ...circle,
      public: true,
      description: 'Updated circle',
      modified: '2026-10-19T12:00:00.000Z',
    };
    saveCircleMock.mockResolvedValue(saved);
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
    // Clearing the file input exercises the empty-files branch.
    fireEvent.change(screen.getByLabelText('Image'), {
      target: { files: [] },
    });
    const image = new File(['image'], 'circle.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Image'), {
      target: { files: [image] },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save circle' }).closest('form')!,
    );
    expect(await screen.findByText('Circle saved.')).toBeVisible();
    expect(saveCircleMock).toHaveBeenCalledWith(
      { ...circle, public: true, description: 'Updated circle' },
      image,
    );
    expect(screen.getByAltText('Current circle')).toHaveAttribute(
      'src',
      `/uploads-circle/walkers/120x120.jpg?v=${new Date(
        saved.modified,
      ).getTime()}`,
    );
    expect(screen.getByLabelText('Image')).toHaveValue('');
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
    saveCircleMock.mockRejectedValueOnce(error);
    render(<AdminCircles />);
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save circle' }).closest('form')!,
    );
    expect(await screen.findByText(message)).toBeVisible();
  });

  it('ignores a second submit while a save is in progress', async () => {
    let resolveSave: (circle: CircleFixture) => void = () => undefined;
    saveCircleMock.mockReturnValue(
      new Promise(resolve => {
        resolveSave = resolve;
      }),
    );
    render(<AdminCircles />);
    const form = screen
      .getByRole('button', { name: 'Save circle' })
      .closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(saveCircleMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    resolveSave({ label: 'Cyclists', public: true });
    expect(await screen.findByText('Circle saved.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save circle' })).toBeEnabled();
  });

  it('keeps the saved circle when the catalogue cannot be reloaded', async () => {
    getCirclesMock
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('Unavailable'));
    saveCircleMock.mockResolvedValue({ label: 'Cyclists', public: true });
    render(<AdminCircles />);
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save circle' }).closest('form')!,
    );
    expect(await screen.findByText('Circle saved.')).toBeVisible();
    expect(
      screen.getByText(
        'Circle saved, but the catalogue could not be reloaded.',
      ),
    ).toBeVisible();
  });

  it('warns when a colour hides white labels', () => {
    render(<AdminCircles />);
    const colour = screen.getByLabelText('Colour');
    fireEvent.change(colour, { target: { value: 'zzzzzz' } });
    expect(
      screen.queryByText('White labels will be hard to read on this colour.'),
    ).not.toBeInTheDocument();
    fireEvent.change(colour, { target: { value: '000000' } });
    expect(
      screen.queryByText('White labels will be hard to read on this colour.'),
    ).not.toBeInTheDocument();
    fireEvent.change(colour, { target: { value: 'ffffff' } });
    expect(
      screen.getByText('White labels will be hard to read on this colour.'),
    ).toBeVisible();
  });
});

describe('circle catalogue table', () => {
  beforeEach(() => {
    getCirclesMock.mockResolvedValue([
      {
        _id: 'a',
        label: 'Alpine Walkers',
        slug: 'alpine-walkers',
        public: true,
        count: 12,
        description: 'Woodland walks',
        image: true,
        modified: '2026-10-21T12:00:00Z',
      },
      {
        _id: 'b',
        label: 'Book Club',
        public: false,
        count: 3,
        description: 'Shared reading',
      },
      { _id: 'c', label: 'Coastal Makers', public: true },
    ]);
  });

  function names() {
    return within(screen.getByRole('table', { name: 'Circles' }))
      .getAllByRole('row')
      .slice(1)
      .map(row => within(row).getByRole('button').textContent);
  }

  it('shows thumbnails, descriptions, hidden status and numeric counts', async () => {
    render(<AdminCircles />);
    const row = (
      await screen.findByRole('button', { name: 'Alpine Walkers' })
    ).closest('tr')!;
    expect(row.querySelector('img')).toHaveAttribute(
      'src',
      '/uploads-circle/alpine-walkers/120x120.jpg?v=1792584000000',
    );
    expect(within(row).getByText('Woodland walks')).toBeInTheDocument();
    expect(within(row).getByText('12', { exact: true })).toBeInTheDocument();
    expect(screen.queryByText('12 members')).not.toBeInTheDocument();
    const hidden = screen
      .getByRole('button', { name: /Book Club/ })
      .closest('tr')!;
    expect(within(hidden).getByText('Hidden')).toBeInTheDocument();
    expect(within(hidden).getByText('3', { exact: true })).toBeInTheDocument();
    const missing = screen
      .getByRole('button', { name: 'Coastal Makers' })
      .closest('tr')!;
    expect(missing.querySelector('img')).not.toBeInTheDocument();
    expect(within(missing).getByText('—')).toBeInTheDocument();
    expect(within(missing).getByText('0')).toBeInTheDocument();
  });

  it('sorts every data column in both directions without changing the selected circle', async () => {
    render(<AdminCircles />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Alpine Walkers' }),
    );
    expect(names()).toEqual([
      'Alpine Walkers',
      'Book ClubHidden',
      'Coastal Makers',
    ]);
    const nameHeader = screen.getByRole('columnheader', { name: 'Name' });
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(within(nameHeader).getByRole('button'));
    expect(names()).toEqual([
      'Coastal Makers',
      'Book ClubHidden',
      'Alpine Walkers',
    ]);
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    fireEvent.click(screen.getByRole('button', { name: 'Members' }));
    expect(names()).toEqual([
      'Coastal Makers',
      'Book ClubHidden',
      'Alpine Walkers',
    ]);
    expect(nameHeader).toHaveAttribute('aria-sort', 'none');
    fireEvent.click(screen.getByRole('button', { name: 'Members' }));
    expect(names()).toEqual([
      'Alpine Walkers',
      'Book ClubHidden',
      'Coastal Makers',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Description' }));
    expect(names()).toEqual([
      'Coastal Makers',
      'Book ClubHidden',
      'Alpine Walkers',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Description' }));
    expect(names()).toEqual([
      'Alpine Walkers',
      'Book ClubHidden',
      'Coastal Makers',
    ]);
    expect(screen.getByLabelText('Name')).toHaveValue('Alpine Walkers');
    expect(
      screen.getByRole('button', { name: 'Alpine Walkers' }).closest('tr'),
    ).toHaveClass('active');
  });

  it('uses the name as a stable tie breaker when sort metadata is missing', async () => {
    getCirclesMock.mockResolvedValueOnce([
      { _id: 'z', label: 'Zulu', public: true },
      { _id: 'b', label: 'Bravo', public: true },
      { _id: 'a', label: 'Alpha', public: true },
    ] as CircleFixture[]);
    render(<AdminCircles />);

    await screen.findByRole('button', { name: 'Zulu' });
    fireEvent.click(screen.getByRole('button', { name: 'Description' }));
    expect(names()).toEqual(['Alpha', 'Bravo', 'Zulu']);
    fireEvent.click(screen.getByRole('button', { name: 'Members' }));
    expect(names()).toEqual(['Alpha', 'Bravo', 'Zulu']);
  });
});
