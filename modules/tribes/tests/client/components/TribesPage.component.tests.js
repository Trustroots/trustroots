import React from 'react';
import { within } from '@testing-library/react';
import { render, fireEvent, waitForElement } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import '@/config/client/i18n';

import TribesPage from '@/modules/tribes/client/components/TribesPage.component';
import * as tribesApi from '@/modules/tribes/client/api/tribes.api';

const api = { tribes: tribesApi };

jest.mock('@/modules/tribes/client/api/tribes.api');

const onMembershipUpdated = jest.fn();

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

// helper function to determine a membership
const isMember = (user, tribe) => user.memberIds.includes(tribe._id);

// TextMatch function for finding an element with arbitrarily nested text
// https://testing-library.com/docs/dom-testing-library/api-queries#textmatch
const nestedTextMatch = text => (content, element) => element.textContent.includes(text);

// helper that renders the TribesPage, waits for the tribes to be loaded from API and returns the rendered page
const renderAndWaitForTribes = async ({ user }) => {
  const page = render(<TribesPage onMembershipUpdated={onMembershipUpdated} user={user} />);

  // the tribes should be displayed
  await waitForElement(() => {
    const items = page.getAllByRole('listitem');
    // we always have the "Send us suggestions!" item
    // so we need to wait (i.e. throw error) until the tribes appear, too...
    expect(items.length).toBeGreaterThan(1);
    return items;
  });

  return page;
};


describe('TribesPage', () => {

  afterEach(() => {
    jest.clearAllMocks();
  });

  let page;

  describe('not signed in', () => {

    beforeEach(async () => {
      page = await renderAndWaitForTribes({ user: null });
    });

    it('fetch tribes from api and show tribes on page', async () => {
      // get tribes and omit the last one, which is "Missing your Tribe?"
      const tribes = page.getAllByRole('listitem').slice(0, -1);

      expect(tribes).toHaveLength(dummyTribes.length);

      tribes.forEach((tribe, i) => {
        expect(tribe).toHaveTextContent(dummyTribes[i].label);
      });

      // the api should be called only once
      expect(api.tribes.read).toHaveBeenCalledTimes(1);
      expect(api.tribes.read).toHaveBeenCalledWith();
    });

    it('the join button should be a link to tribe page', async () => {
      // get tribes and omit the last one, which is "Missing your Tribe?"
      const tribes = page.getAllByRole('listitem').slice(0, -1);

      tribes.forEach((tribe, i) => {
        // the join button
        const button = within(tribe).getByText('Join');
        expect(button).toHaveAttribute('href', `/signup?tribe=${dummyTribes[i].slug}`);
      });
    });

  });

  describe('signed in', () => {

    beforeEach(async () => {
      page = await renderAndWaitForTribes({ user: dummyUser });
    });

    it('show tribes on page', async () => {
      // get tribes and omit the last one, which is "Missing your Tribe?"
      const tribes = page.getAllByRole('listitem').slice(0, -1);

      expect(tribes).toHaveLength(dummyTribes.length);

      tribes.forEach((tribe, i) => {
        expect(tribe).toHaveTextContent(dummyTribes[i].label);
      });

      // during the test the api should be called only once
      expect(api.tribes.read).toHaveBeenCalledTimes(1);
      expect(api.tribes.read).toHaveBeenCalledWith();
    });

    it('user is member of some tribes and not member of others', async () => {

      dummyTribes.forEach(tribeData => {
        const tribe = page.getByText(nestedTextMatch(tribeData.label), { selector: 'li' });

        if (isMember(dummyUser, tribeData)) {
          within(tribe).getByText('Joined', { selector: 'button' });
        } else {
          within(tribe).getByText('Join', { selector: 'button' });
        }
      });

    });

    for (const tribeData of dummyTribes) {
      if (isMember(dummyUser, tribeData)) {

        it('[user is a member] click leave with modal and send api request', async () => {
          expect(api.tribes.leave).toHaveBeenCalledTimes(0);

          // Find the tribe item...
          const tribe = page.getByText(nestedTextMatch(tribeData.label), { selector: 'li' });
          // ...find the Joined button...
          const joined = within(tribe).getByText('Joined', { selector: 'button' });
          // ...and click it!
          fireEvent.click(joined);

          // Confirmation modal should open...
          const modal = await waitForElement(() => page.getByText(nestedTextMatch('Leave this Tribe?'), { selector: '.modal-dialog' }));

          // ...and we click Leave Tribe button within it.
          const confirm = within(modal).getByText('Leave Tribe', { selector: 'button' });
          fireEvent.click(confirm);

          // Wait until the Joined button changes to Join
          await waitForElement(() => within(tribe).getByText('Join', { selector: 'button' }));

          // Check that api and onMembershipUpdated was called.
          expect(api.tribes.leave).toHaveBeenCalledTimes(1);
          expect(api.tribes.leave).toHaveBeenCalledWith(tribeData._id);
          expect(onMembershipUpdated).toHaveBeenCalledTimes(1);
          expect(onMembershipUpdated).toHaveBeenCalledWith({ tribe: tribeData });
        });

      } else {

        it('[user is not a member] click join and send api request', async () => {
          expect(api.tribes.join).toHaveBeenCalledTimes(0);

          // Find the tribe item...
          const tribe = page.getByText(nestedTextMatch(tribeData.label), { selector: 'li' });
          // ...find the Join button...
          const join = within(tribe).getByText('Join', { selector: 'button' });
          // ...and click it!
          fireEvent.click(join);

          // Wait until the Join button changes to Joined
          await waitForElement(() => within(tribe).getByText('Joined', { selector: 'button' }));

          // Check that api and onMembershipUpdated was called.
          expect(api.tribes.join).toHaveBeenCalledTimes(1);
          expect(api.tribes.join).toHaveBeenCalledWith(tribeData._id);
          expect(onMembershipUpdated).toHaveBeenCalledTimes(1);
          expect(onMembershipUpdated).toHaveBeenCalledWith({ tribe: tribeData });
        });

      }
    }
  });
});
