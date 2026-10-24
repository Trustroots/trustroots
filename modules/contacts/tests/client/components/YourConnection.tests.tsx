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
import '@/config/client/i18n';
import YourConnection from '../../../client/components/YourConnection';
import * as contacts from '../../../client/api/contacts.api';
import * as experiences from '@/modules/experiences/client/api/experiences.api';
import * as feedback from '@/modules/references-thread/client/api/reference-thread.api';
import { useSettings } from '@/modules/core/client/react-app/AppProviders';
import type { ExperienceMine } from '@/modules/experiences/shared/experience';

jest.mock('../../../client/api/contacts.api');
jest.mock('@/modules/experiences/client/api/experiences.api');
jest.mock('@/modules/references-thread/client/api/reference-thread.api');
jest.mock('@/modules/core/client/react-app/AppProviders', () => ({
  useSettings: jest.fn(),
}));

const viewer = {
  _id: 'viewer',
  username: 'cedar',
  displayName: 'Cedar',
  public: true,
};
const member = {
  _id: 'other',
  username: 'rowan',
  displayName: 'Rowan',
  public: true,
};
const getContact = jest.mocked(contacts.getByUserId);
const readMine = jest.mocked(experiences.readMine);
const getFeedback = jest.mocked(feedback.get);
const sendFeedback = jest.mocked(feedback.send);
const remove = jest.mocked(contacts.remove);
const settings = jest.mocked(useSettings);
const section = (name: string) => within(screen.getByRole('region', { name }));
const fact = (experience: ReturnType<typeof section>, label: string) =>
  within(
    experience.getByRole('rowheader', { name: label }).parentElement!,
  ).getByRole('cell');
const feedbackSection = () => section('Private message feedback');
const clickFeedbackButton = (name: string) =>
  fireEvent.click(feedbackSection().getByRole('button', { name }));
const api404 = (eligible?: boolean) => ({
  response: {
    status: 404,
    data: eligible === undefined ? {} : { allowCreatingReference: eligible },
  },
});
const experience: ExperienceMine = {
  _id: 'experience',
  created: '2026-01-01',
  public: false,
  userFrom: viewer._id,
  userTo: member._id,
  interactions: { met: true, host: true, guest: false },
  recommend: 'yes',
  feedbackPublic: 'A fictional visit.',
  response: {
    _id: 'response',
    created: '2026-01-02',
    interactions: { met: false, host: false, guest: true },
    recommend: 'no',
    feedbackPublic: 'A different account.',
  },
};
function mount(
  props: Partial<React.ComponentProps<typeof YourConnection>> = {},
) {
  return render(<YourConnection viewer={viewer} member={member} {...props} />);
}
async function loaded() {
  await waitFor(() =>
    expect(screen.queryAllByText('Loading…')).toHaveLength(0),
  );
}
beforeEach(() => {
  jest.resetAllMocks();
  settings.mockReturnValue({ referencesEnabled: true });
  getContact.mockResolvedValue(null);
  readMine.mockResolvedValue(null);
  getFeedback.mockRejectedValue(api404(true));
  sendFeedback.mockResolvedValue({});
  remove.mockResolvedValue();
});

it('shows independent absent records and eligible feedback without requiring a contact', async () => {
  mount();
  await loaded();
  expect(section('Contact').getByText('No contact')).toBeVisible();
  expect(
    section('Contact').getByRole('link', { name: 'Add contact' }),
  ).toHaveAttribute('href', '/contact-add/other');
  expect(
    section('Your Experience').getByRole('link', {
      name: 'Share your experience',
    }),
  ).toHaveAttribute('href', '/profile/rowan/experiences/new');
  expect(feedbackSection().getByText('Not recorded')).toBeVisible();
  clickFeedbackButton('Yes');
  await waitFor(() =>
    expect(sendFeedback).toHaveBeenCalledWith('yes', 'other'),
  );
  expect(
    await feedbackSection().findByRole('button', { name: 'Change' }),
  ).toBeVisible();
  clickFeedbackButton('Change');
  clickFeedbackButton('No');
  await waitFor(() => expect(feedbackSection().getByText('No')).toBeVisible());
  expect(experiences.create).not.toHaveBeenCalled();
});

it.each([
  [
    'incoming',
    member._id,
    false,
    'Incoming contact request',
    'Decline request',
  ],
  ['outgoing', viewer._id, false, 'Outgoing contact request', 'Cancel request'],
  ['confirmed', viewer._id, true, 'Confirmed contact', 'Remove contact'],
] as const)(
  'shows %s contacts and uses the existing removal dialogue',
  async (_state, userFrom, confirmed, label, action) => {
    getContact.mockResolvedValue({
      _id: 'contact',
      userFrom,
      userTo: userFrom === viewer._id ? member._id : viewer._id,
      confirmed,
      created: '2026-01-01',
    });
    const onContactRemoved = confirmed ? jest.fn() : undefined;
    mount({ onContactRemoved });
    await loaded();
    expect(section('Contact').getByText(label)).toBeVisible();
    if (userFrom === member._id)
      expect(
        section('Contact').getByRole('link', { name: 'Confirm contact' }),
      ).toHaveAttribute('href', '/contact-confirm/contact');
    fireEvent.click(section('Contact').getByRole('button', { name: action }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(section('Contact').getByRole('button', { name: action }));
    getContact.mockResolvedValue(null);
    fireEvent.click(screen.getByRole('button', { name: /^Yes, / }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('contact'));
    expect(await section('Contact').findByText('No contact')).toBeVisible();
    if (confirmed)
      expect(onContactRemoved).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'contact' }),
      );
  },
);

it('reports rejected contact changes and refreshes the section', async () => {
  getContact.mockResolvedValue({
    _id: 'contact',
    userFrom: viewer._id,
    created: '2026-01-01',
    confirmed: true,
  });
  remove.mockRejectedValue(new Error('restricted'));
  mount();
  await loaded();
  fireEvent.click(
    section('Contact').getByRole('button', { name: 'Remove contact' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Yes, remove contact' }));
  expect(await section('Contact').findByRole('alert')).toHaveTextContent(
    'Could not save',
  );
  await waitFor(() => expect(getContact).toHaveBeenCalledTimes(2));
});

it.each([403, 404])(
  'does not offer new contact actions after a %s mutation rejection, even when the refreshed contact is absent',
  async status => {
    getContact.mockResolvedValueOnce({
      _id: 'contact',
      userFrom: viewer._id,
      confirmed: true,
      created: '2026-01-01',
    });
    remove.mockRejectedValue({ response: { status } });
    mount();
    await loaded();
    fireEvent.click(
      section('Contact').getByRole('button', { name: 'Remove contact' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Yes, remove contact' }),
    );
    expect(await section('Contact').findByText('No contact')).toBeVisible();
    expect(section('Contact').getByRole('alert')).toBeVisible();
    expect(section('Contact').queryByRole('link')).not.toBeInTheDocument();
    expect(feedbackSection().queryByRole('button')).not.toBeInTheDocument();
  },
);

it.each([403, 404])(
  'preserves answered feedback without re-enabling mutations after a %s rejection',
  async status => {
    getFeedback.mockResolvedValue({ reference: 'yes', created: '2026-01-01' });
    sendFeedback.mockRejectedValue({ response: { status } });
    mount();
    await loaded();
    clickFeedbackButton('Change');
    clickFeedbackButton('No');
    expect(await feedbackSection().findByRole('alert')).toBeVisible();
    await waitFor(() => expect(getFeedback).toHaveBeenCalledTimes(2));
    expect(feedbackSection().getByText('Yes')).toBeVisible();
    expect(feedbackSection().queryByRole('button')).not.toBeInTheDocument();
    expect(section('Contact').queryByRole('link')).not.toBeInTheDocument();
  },
);

it('keeps authored accounts separate and does not invent reciprocal publication status', async () => {
  readMine.mockResolvedValue(experience);
  mount();
  await loaded();
  const yours = section('Your Experience');
  const theirs = section('Their Experience');
  expect(yours.getByText('Written by Cedar')).toBeVisible();
  expect(yours.getByText('Awaiting publication')).toBeVisible();
  expect(yours.getByText(/at most in 14 days/)).toBeVisible();
  expect(yours.getByText('You hosted this member')).toBeVisible();
  expect(fact(yours, 'Recommendation')).toHaveTextContent('Yes');
  expect(yours.getByRole('link', { name: 'View Experiences' })).toHaveAttribute(
    'href',
    '/profile/rowan/experiences',
  );
  expect(theirs.getByText('Written by Rowan')).toBeVisible();
  expect(fact(theirs, 'Met in person')).toHaveTextContent('No');
  expect(fact(theirs, 'Recommendation')).toHaveTextContent('No');
  expect(theirs.getByText('You hosted this member')).toBeVisible();
  expect(theirs.queryByText('Awaiting publication')).not.toBeInTheDocument();
});

it('handles an other-authored primary with hidden details and unknown meeting answers', async () => {
  readMine.mockResolvedValue({
    ...experience,
    userFrom: { _id: member._id, username: member.username },
    userTo: viewer._id,
    interactions: undefined,
    recommend: undefined,
    feedbackPublic: undefined,
    response: {
      ...experience.response!,
      interactions: { met: true, host: false, guest: true },
      recommend: 'unknown',
    },
  });
  mount();
  await loaded();
  expect(fact(section('Their Experience'), 'Met in person')).toHaveTextContent(
    'Not recorded',
  );
  expect(
    section('Their Experience').queryByText('A fictional visit.'),
  ).not.toBeInTheDocument();
  expect(
    section('Your Experience').getByText('This member hosted you'),
  ).toBeVisible();
  expect(fact(section('Your Experience'), 'Recommendation')).toHaveTextContent(
    'Not recorded',
  );
  expect(
    section('Your Experience').queryByText('Awaiting publication'),
  ).not.toBeInTheDocument();
});

it('shows public other accounts and explicit author hosting roles', async () => {
  readMine.mockResolvedValue({
    ...experience,
    public: true,
    userFrom: member._id,
    userTo: viewer._id,
    response: null,
  });
  mount();
  await loaded();
  expect(section('Their Experience').getByText('Public')).toBeVisible();
  expect(
    section('Their Experience').getByText('This member hosted you'),
  ).toBeVisible();
  expect(
    section('Your Experience').getByText('No Experience shared yet.'),
  ).toBeVisible();
});

it('names authors by username when a display name is unavailable', async () => {
  readMine.mockResolvedValue(experience);
  mount({
    viewer: { ...viewer, displayName: undefined },
    member: { ...member, displayName: undefined },
  });
  await loaded();
  expect(
    section('Your Experience').getByText('Written by cedar'),
  ).toBeVisible();
  expect(
    section('Their Experience').getByText('Written by rowan'),
  ).toBeVisible();
  expect(
    section('Your Experience').getByText(/when rowan shares their experience/),
  ).toBeVisible();
});

it.each([api404(false), null])(
  'does not offer feedback without explicit eligibility: %s',
  async response => {
    if (response === null) getFeedback.mockResolvedValue(null);
    else getFeedback.mockRejectedValue(response);
    mount();
    await loaded();
    expect(feedbackSection().queryByRole('button')).not.toBeInTheDocument();
  },
);

it.each([new Error('offline'), api404()])(
  'keeps failed sources distinct from absence and supports independent retry: %s',
  async error => {
    getFeedback.mockRejectedValue(error);
    getContact.mockRejectedValueOnce(error);
    readMine.mockRejectedValueOnce(error);
    mount();
    await loaded();
    expect(
      section('Contact').queryByRole('link', { name: 'Add contact' }),
    ).not.toBeInTheDocument();
    expect(
      section('Your Experience').queryByRole('link'),
    ).not.toBeInTheDocument();
    getFeedback.mockRejectedValue(api404(true));
    fireEvent.click(section('Contact').getByRole('button', { name: 'Retry' }));
    expect(await section('Contact').findByText('No contact')).toBeVisible();
    expect(feedbackSection().getByRole('alert')).toBeVisible();
    fireEvent.click(
      section('Your Experience').getByRole('button', { name: 'Retry' }),
    );
    expect(await section('Your Experience').findByRole('link')).toBeVisible();
    fireEvent.click(
      feedbackSection().getByRole('button', {
        name: 'Retry',
      }),
    );
    expect(
      await feedbackSection().findByRole('button', {
        name: 'Yes',
      }),
    ).toBeVisible();
  },
);

it.each([true, false])(
  'retains the confirmed answer when saving fails, refreshes eligibility and retries (refresh succeeds: %s)',
  async refreshSucceeds => {
    getFeedback.mockResolvedValue({ reference: 'yes', created: '2026-01-01' });
    sendFeedback.mockRejectedValueOnce(new Error('offline'));
    mount();
    await loaded();
    if (!refreshSucceeds) getFeedback.mockRejectedValue(new Error('offline'));
    clickFeedbackButton('Change');
    clickFeedbackButton('No');
    expect(await feedbackSection().findByRole('alert')).toHaveTextContent(
      'Could not save',
    );
    expect(feedbackSection().getByText('Yes', { selector: 'p' })).toBeVisible();
    clickFeedbackButton('Retry');
    expect(
      await feedbackSection().findByRole('button', {
        name: 'Change',
      }),
    ).toBeVisible();
    expect(feedbackSection().getByText('No')).toBeVisible();
  },
);

it('makes no feature requests when disabled and resets on flag changes', async () => {
  settings.mockReturnValue({});
  const view = mount();
  await loaded();
  expect(readMine).not.toHaveBeenCalled();
  expect(getFeedback).not.toHaveBeenCalled();
  expect(section('Your Experience').getByText('Unavailable')).toBeVisible();
  settings.mockReturnValue({ referencesEnabled: true });
  view.rerender(<YourConnection viewer={viewer} member={member} />);
  await loaded();
  expect(readMine).toHaveBeenCalledWith({ userWith: 'other' });
});

it('preserves the last answer and reports a rejected save when eligibility is revoked', async () => {
  getFeedback.mockResolvedValueOnce({
    reference: 'yes',
    created: '2026-01-01',
  });
  sendFeedback.mockRejectedValue(new Error('restricted'));
  mount();
  await loaded();
  getFeedback.mockRejectedValue(api404(false));
  clickFeedbackButton('Change');
  clickFeedbackButton('No');
  expect(await feedbackSection().findByRole('alert')).toHaveTextContent(
    'Could not save',
  );
  await waitFor(() =>
    expect(feedbackSection().queryByRole('button')).not.toBeInTheDocument(),
  );
  expect(feedbackSection().getByText('Yes')).toBeVisible();
});

it.each([
  { viewer: { ...viewer, public: false } },
  { viewer: { ...viewer, roles: ['suspended'] } },
  { member: viewer },
  { member: { ...member, username: undefined } },
  { member: { ...member, public: false } },
  { member: { ...member, roles: ['shadowban'] } },
  { available: false },
])('does not read private sources for unavailable pairs: %s', props => {
  mount(props);
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(getContact).not.toHaveBeenCalled();
});

it('allows Experience writing and private feedback while a member is blocked', async () => {
  mount({ viewer: { ...viewer, blocked: [member._id], roles: ['user'] } });
  await loaded();
  expect(section('Contact').queryByRole('link')).not.toBeInTheDocument();
  clickFeedbackButton('No');
  await waitFor(() =>
    expect(sendFeedback).toHaveBeenCalledWith('no', member._id),
  );
  fireEvent.click(
    await feedbackSection().findByRole('button', {
      name: 'Change',
    }),
  );
  clickFeedbackButton('Yes');
  await waitFor(() =>
    expect(sendFeedback).toHaveBeenCalledWith('yes', member._id),
  );
  expect(
    await feedbackSection().findByRole('button', {
      name: 'Change',
    }),
  ).toBeVisible();
  expect(
    section('Your Experience').getByRole('link', {
      name: 'Share your experience',
    }),
  ).toBeVisible();
});

it('refreshes externally removed contacts without reloading the other sources', async () => {
  getContact.mockResolvedValueOnce({
    _id: 'contact',
    userFrom: viewer._id,
    confirmed: true,
  });
  const view = mount({ contactRefreshKey: 'contact' });
  await loaded();
  expect(section('Contact').getByText('Confirmed contact')).toBeVisible();
  view.rerender(<YourConnection viewer={viewer} member={member} />);
  expect(await section('Contact').findByText('No contact')).toBeVisible();
  expect(
    section('Contact').queryByRole('button', { name: 'Remove contact' }),
  ).not.toBeInTheDocument();
  expect(getContact).toHaveBeenCalledTimes(2);
  expect(readMine).toHaveBeenCalledTimes(1);
  expect(getFeedback).toHaveBeenCalledTimes(1);
});

it('clears previous-pair data and ignores late successes and failures after pair/account changes', async () => {
  let resolveContact!: (
    value: Awaited<ReturnType<typeof contacts.getByUserId>>,
  ) => void;
  let rejectExperience!: (error: Error) => void;
  getContact.mockReturnValueOnce(
    new Promise(resolve => {
      resolveContact = resolve;
    }),
  );
  readMine.mockReturnValueOnce(
    new Promise((_resolve, reject) => {
      rejectExperience = reject;
    }),
  );
  const view = mount();
  const third = { ...member, _id: 'third', username: 'elm' };
  view.rerender(<YourConnection viewer={viewer} member={third} />);
  await loaded();
  await act(async () => {
    resolveContact({ _id: 'stale', confirmed: true });
    rejectExperience(new Error('old pair'));
  });
  expect(section('Contact').getByText('No contact')).toBeVisible();
  expect(screen.queryByText('Confirmed contact')).not.toBeInTheDocument();
  readMine.mockResolvedValue(experience);
  view.rerender(<YourConnection viewer={viewer} member={member} />);
  expect(
    await section('Your Experience').findByText('A fictional visit.'),
  ).toBeVisible();
  readMine.mockResolvedValue(null);
  view.rerender(
    <YourConnection
      viewer={{ ...viewer, _id: 'new-viewer' }}
      member={member}
    />,
  );
  expect(screen.queryByText('A fictional visit.')).not.toBeInTheDocument();
  await loaded();
});
