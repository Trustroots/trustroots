import { fetch, fetchMini, update } from '../../client/api/users.api.js';

async function checkProfileClientApiContracts() {
  const publicOrOwnProfile = await fetch('fictional-member');
  const ownProfile = await update({
    firstName: 'Fictional',
    email: 'member@example.test',
  });
  const miniProfile = await fetchMini('fictional-user-id');

  ownProfile.email;
  ownProfile.public;
  miniProfile.username;

  // @ts-expect-error A public-profile fetch is not guaranteed to include email.
  publicOrOwnProfile.email;
  // @ts-expect-error Auth bootstrap roles do not belong to the profile response.
  ownProfile.roles;
  // @ts-expect-error Mini profiles omit full-profile descriptions.
  miniProfile.description;
  // @ts-expect-error PUT /api/users does not accept auth bootstrap state.
  await update({ subscriptions: { news: true } });
  // @ts-expect-error Public access-control status is not a profile update field.
  await update({ public: true });
}

void checkProfileClientApiContracts;
