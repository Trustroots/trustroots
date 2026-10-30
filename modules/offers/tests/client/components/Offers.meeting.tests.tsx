import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { Offers } from '@/modules/offers/client/components/Offers.component';
import { getOffers, updateOffer } from '@/modules/offers/client/api/offers.api';
import type { OfferPayload } from '@/modules/offers/shared/offer';

jest.mock('@/modules/offers/client/api/offers.api');
jest.mock(
  '@/modules/offers/client/components/OfferLocation.component',
  () =>
    function MockOfferLocation() {
      return <div data-testid="location-map" />;
    },
);
const getOffersMock = jest.mocked(getOffers);
const updateOfferMock = jest.mocked(updateOffer);
const offer: OfferPayload = {
  _id: 'offer-1',
  type: 'host',
  user: 'member-1',
  status: 'no',
  location: [51, 4],
};
const owner = { _id: 'member-1', public: true, username: 'ada' };

beforeEach(() => {
  jest.resetAllMocks();
  getOffersMock.mockResolvedValue([offer]);
  updateOfferMock.mockResolvedValue({ message: 'Offer saved.' });
});

it('defaults to Not set and saves all four states without changing hosting', async () => {
  render(<Offers authUser={owner} profile={owner} />);
  expect(await screen.findByRole('radio', { name: 'Not set' })).toBeChecked();
  for (const [label, meetingStatus] of [
    ['Yes', 'yes'],
    ['Maybe', 'maybe'],
    ['No', 'no'],
    ['Not set', 'not-set'],
  ] as const) {
    fireEvent.click(screen.getByRole('radio', { name: label }));
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: label })).toBeChecked(),
    );
    expect(updateOfferMock).toHaveBeenLastCalledWith('offer-1', {
      meetingStatus,
      location: [51, 4],
    });
    expect(screen.getByText('Cannot host currently')).toBeVisible();
  }
});

it('keeps the old value on failure and permits retry', async () => {
  updateOfferMock.mockRejectedValueOnce(new Error('offline'));
  render(<Offers authUser={owner} profile={owner} />);
  fireEvent.click(await screen.findByRole('radio', { name: 'Yes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not save meeting availability',
  );
  expect(screen.getByRole('radio', { name: 'Not set' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
  await waitFor(() =>
    expect(screen.getByRole('radio', { name: 'Yes' })).toBeChecked(),
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('disables controls and prevents duplicate writes while saving', async () => {
  let resolve!: (result: { message: 'Offer saved.' }) => void;
  updateOfferMock.mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  const ref = React.createRef<Offers>();
  render(<Offers ref={ref} authUser={owner} profile={owner} />);
  fireEvent.click(await screen.findByRole('radio', { name: 'Maybe' }));
  expect(screen.getByRole('status')).toHaveTextContent('Saving');
  expect(screen.getByRole('radio', { name: 'Yes' })).toBeDisabled();
  await act(async () => {
    await ref.current!.saveMeetingStatus('yes');
  });
  expect(updateOfferMock).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve({ message: 'Offer saved.' });
  });
  expect(screen.getByRole('radio', { name: 'Maybe' })).toBeChecked();
});

it('shows visitors only the saved status, without editing controls', async () => {
  getOffersMock.mockResolvedValue([{ ...offer, meetingStatus: 'maybe' }]);
  const ref = React.createRef<Offers>();
  render(
    <Offers
      ref={ref}
      authUser={{ _id: 'visitor', public: true }}
      profile={owner}
    />,
  );
  expect(await screen.findByText('ada is maybe up for meeting')).toBeVisible();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  await act(async () => {
    await ref.current!.saveMeetingStatus('yes');
  });
  expect(updateOfferMock).not.toHaveBeenCalled();
});

it('directs owners without an offer to set a location', async () => {
  getOffersMock.mockResolvedValue([]);
  const ref = React.createRef<Offers>();
  render(<Offers ref={ref} authUser={owner} profile={owner} />);
  expect(
    await screen.findByRole('link', {
      name: /Set your location and availability/,
    }),
  ).toHaveAttribute('href', '/offer/host#location');
  await act(async () => {
    await ref.current!.saveMeetingStatus('yes');
  });
  expect(updateOfferMock).not.toHaveBeenCalled();
});

it('does not save an offer without a location', async () => {
  const ref = React.createRef<Offers>();
  render(<Offers ref={ref} authUser={owner} profile={owner} />);
  await screen.findByRole('radio', { name: 'Not set' });
  act(() => ref.current!.setState({ offer: { _id: 'offer-1', status: 'no' } }));
  await act(async () => {
    await ref.current!.saveMeetingStatus('yes');
  });
  expect(updateOfferMock).not.toHaveBeenCalled();
});
