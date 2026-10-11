import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import SearchCirclesToggle from '@/modules/search/client/components/SearchCirclesToggle.component';
import {
  read,
  type TribeSummary,
} from '@/modules/tribes/client/api/tribes.api';

type ChangeHandler = React.ComponentProps<
  typeof SearchCirclesToggle
>['onChange'];

const readMock = jest.mocked(read);
const cyclists: TribeSummary = {
  _id: 'cyclists',
  slug: 'cyclists',
  label: 'Cyclists',
  count: 2,
};
const hikers: TribeSummary = {
  _id: 'hikers',
  slug: 'hikers',
  label: 'Hikers',
  count: 2,
};

jest.mock('@/modules/tribes/client/api/tribes.api');

describe('SearchCirclesToggle', () => {
  const onChange = jest.fn<
    ReturnType<ChangeHandler>,
    Parameters<ChangeHandler>
  >();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders circle toggles and reports selection changes', async () => {
    readMock.mockResolvedValue([cyclists, hikers]);

    render(
      <SearchCirclesToggle
        onChange={onChange}
        selectedTribeIds={['cyclists']}
      />,
    );

    expect(
      await screen.findByRole('checkbox', { name: 'Cyclists' }),
    ).toBeChecked();
    screen.getAllByRole('checkbox').forEach(toggle => {
      expect(toggle.nextElementSibling).toHaveClass('toggle');
    });
    expect(screen.getByRole('checkbox', { name: 'Hikers' })).not.toBeChecked();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Hikers' }));

    expect(onChange).toHaveBeenCalledWith(['cyclists', 'hikers']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hikers' }));
    expect(onChange).toHaveBeenLastCalledWith(['cyclists']);
  });

  it('renders nothing when no circles are available', async () => {
    readMock.mockResolvedValue([]);

    const { container } = render(
      <SearchCirclesToggle onChange={onChange} selectedTribeIds={[]} />,
    );

    await waitFor(() => {
      expect(readMock).toHaveBeenCalled();
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when loading circles fails', async () => {
    readMock.mockRejectedValue(new Error('network'));

    const { container } = render(
      <SearchCirclesToggle onChange={onChange} selectedTribeIds={[]} />,
    );

    await waitFor(() => expect(readMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('handles an empty circle response', async () => {
    // Deliberately malformed response exercises the defensive fallback.
    readMock.mockResolvedValue(null as unknown as TribeSummary[]);

    const { container } = render(
      <SearchCirclesToggle onChange={onChange} selectedTribeIds={[]} />,
    );

    await waitFor(() => expect(readMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('ignores circle responses after unmounting', async () => {
    let resolveCircles!: (circles: TribeSummary[]) => void;
    readMock.mockReturnValue(
      new Promise(resolve => {
        resolveCircles = resolve;
      }),
    );

    const { unmount } = render(
      <SearchCirclesToggle onChange={onChange} selectedTribeIds={[]} />,
    );
    unmount();
    resolveCircles([cyclists]);

    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores circle failures after unmounting', async () => {
    let rejectCircles!: (error: Error) => void;
    readMock.mockReturnValue(
      new Promise((resolve, reject) => {
        rejectCircles = reject;
      }),
    );

    const { unmount } = render(
      <SearchCirclesToggle onChange={onChange} selectedTribeIds={[]} />,
    );
    unmount();
    rejectCircles(new Error('late failure'));

    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalled();
  });
});
