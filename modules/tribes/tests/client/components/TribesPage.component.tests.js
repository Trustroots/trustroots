/* tests to write

when clicking join and not logged in, redirect to tribe page
when clicking join and logged in, send a request to join to API
when clicking join and logged in, update the number of tribe members
when clicking leave, send a request to leave to API
when clicking leave and logged in, update the number of tribe members


*/

import React from 'react';
import { within } from '@testing-library/react';
import { render, fireEvent, wait } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import '@/config/client/i18n';

import TribesPage from '@/modules/tribes/client/components/TribesPage.component';
import * as tribesApi from '@/modules/tribes/client/api/tribes.api';

const api = { tribes: tribesApi };

jest.mock('@/modules/tribes/client/api/tribes.api');

const dummyTribes = [{
  _id: 'aaaa',
  id: 'aaaa',
  count: 20000,
  slug: 'hitchhikers',
  label: 'Hitchhikers',
}, {
  _id: 'bbbb',
  id: 'bbbb',
  count: 5000,
  slug: 'snails',
  label: 'Snails',
}, {
  _id: 'cccc',
  id: 'cccc',
  count: 1500,
  slug: 'teddybears',
  label: 'Teddy Bears',
}];

const dummyUser = {
  _id: 'user0',
  id: 'user0',
  memberIds: ['cccc', 'aaaa'],
};

api.tribes.read.mockImplementation(async () => dummyTribes);
api.tribes.join.mockImplementation(async id => ({ tribe: dummyTribes.find(tribe => tribe._id === id) }));
api.tribes.leave.mockImplementation(async id => ({ tribe: dummyTribes.find(tribe => tribe._id === id) }));


describe('TribesPage', () => {

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('not signed in', () => {

    it('fetch tribes from api and show tribes on page', async () => {
      // first no api should be called
      expect(api.tribes.read).toHaveBeenCalledTimes(0);

      const { getAllByRole } = render(<TribesPage onMembershipUpdated={() => {}} />);

      await wait();

      // the tribes from api should be displayed
      const tribes = getAllByRole('listitem');
      expect(tribes).toHaveLength(dummyTribes.length + 1); // there is additionally the Suggest Tribe

      tribes.slice(0, -1).forEach((tribe, i) => {
        expect(tribe).toHaveTextContent(dummyTribes[i].label);
      });

      // during the test the api should be called only once
      expect(api.tribes.read).toHaveBeenCalledTimes(1);
      expect(api.tribes.read).toHaveBeenCalledWith();
    });

    it('the join button should be a link to tribe page', async () => {
      const { getAllByRole } = render(<TribesPage onMembershipUpdated={() => {}} />);

      await wait();

      // join button
      const tribes = getAllByRole('listitem').slice(0, -1);

      tribes.forEach((tribe, i) => {
        const button = within(tribe).getByText('Join');
        expect(button).toHaveAttribute('href', `/signup?tribe=${dummyTribes[i].slug}`);
      });
    });

  });

  describe('signed in', () => {

    it('show tribes on page', async () => {
      // first no api should be called
      expect(api.tribes.read).toHaveBeenCalledTimes(0);

      const { getAllByRole } = render(<TribesPage user={dummyUser} onMembershipUpdated={() => {}} />);

      await wait();

      // the tribes from api should be displayed
      const tribes = getAllByRole('listitem');
      expect(tribes).toHaveLength(dummyTribes.length + 1); // there is additionally the Suggest Tribe

      tribes.slice(0, -1).forEach((tribe, i) => {
        expect(tribe).toHaveTextContent(dummyTribes[i].label);
      });

      // during the test the api should be called only once
      expect(api.tribes.read).toHaveBeenCalledTimes(1);
      expect(api.tribes.read).toHaveBeenCalledWith();
    });

    it('user is member of some tribes and not member of others', async () => {
      const { getAllByText } = render(<TribesPage user={dummyUser} onMembershipUpdated={() => {}} />);

      await wait();

      // the tribes from api should be displayed
      expect(queryAllByText('Join')).toHaveLength(1);
      expect(queryAllByText('Joined')).toHaveLength(2);
    });

    it('click join and send api request', async () => {
      expect(api.tribes.join).toHaveBeenCalledTimes(0);
      const { getAllByText } = render(<TribesPage user={dummyUser} onMembershipUpdated={() => {}} />);

      await wait();

      // click the join button
      const join = getAllByText('Join');
      expect(join).toHaveLength(1);
      fireEvent.click(join[0]);

      await wait();

      // api should be called
      expect(api.tribes.join).toHaveBeenCalledTimes(1);
      expect(api.tribes.join).toHaveBeenCalledWith(73);
    });

    it('click leave with modal and send api request', async () => {
      expect(api.tribes.leave).toHaveBeenCalledTimes(0);

      const { getAllByText } = render(<TribesPage user={dummyUser} onMembershipUpdated={() => {}} />);

      await wait();

      // click the first Joined button
      const buttons = getAllByText('Joined');
      expect(buttons).toHaveLength(2);
      fireEvent.click(buttons[0]);

      await wait();

      // confirmation modal should open
      // we'll click Confirm
      const confirm = getAllByText('Leave Tribe');
      expect(confirm).toHaveLength(1);
      fireEvent.click(confirm[0]);

      await wait();

      // and the api was called as expected
      expect(api.tribes.leave).toHaveBeenCalledTimes(1);
    });

  });

});
