const { annotateFeature, expect, test } = require('../../support/test');
const {
  createUser,
  registerViaApi,
  signInViaApi,
} = require('../../support/helpers');
const { findUserByUsername, withE2eDb } = require('../../support/db');

test('welcome team location correction review sends from the current member', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.location-corrections', [
    'Welcome team reviews a former-default location candidate.',
    'Welcome team sends a personalised message and the candidate leaves the queue.',
  ]);
  const sender = createUser({ firstName: 'Morgan', lastName: 'Greeter' });
  const recipient = createUser({ firstName: 'Casey', lastName: 'Visitor' });
  await registerViaApi(request, sender);
  await registerViaApi(request, recipient);
  const senderDoc = await findUserByUsername(sender.username);
  const recipientDoc = await findUserByUsername(recipient.username);
  let offerId;

  try {
    await withE2eDb(async db => {
      await db
        .collection('users')
        .updateOne({ _id: recipientDoc._id }, { $set: { public: true } });
      await db.collection('users').updateOne(
        { _id: senderDoc._id },
        {
          $set: {
            public: true,
            roles: ['user', 'welcome-team'],
            description:
              'I welcome new members and help them make their profiles useful. I enjoy sharing local knowledge and supporting thoughtful conversations across the community.',
          },
        },
      );
      const result = await db.collection('offers').insertOne({
        user: recipientDoc._id,
        type: 'host',
        status: 'yes',
        description: 'A fictional place to stay.',
        location: [48.6908333333, 9.14055555556],
        locationFuzzy: [48.691, 9.141],
        updated: new Date(),
        createdAt: new Date(),
      });
      offerId = result.insertedId;
    });

    await signInViaApi(page, request, sender);
    await page.goto('/admin/location-corrections');
    await expect(page.getByText('Exact default location')).toBeVisible();
    await page
      .getByRole('button', { name: `Review ${recipient.username}` })
      .click();
    const message = `Hello Casey, please check your hosting location at ${page.url()}.`;
    await page.getByLabel('Message from your account').fill(message);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('status')).toContainText(
      'Message sent to Casey Visitor.',
    );
    await expect(
      page.getByRole('button', { name: `Review ${recipient.username}` }),
    ).toHaveCount(0);

    const saved = await withE2eDb(db =>
      db.collection('messages').findOne({
        userFrom: senderDoc._id,
        userTo: recipientDoc._id,
      }),
    );
    expect(saved).toBeTruthy();
    expect(saved.content).toContain(
      'Hello Casey, please check your hosting location',
    );
    expect(saved.content).toContain(page.url());
    expect(saved.locationCorrectionOffers[0].offer.toString()).toBe(
      offerId.toString(),
    );
  } finally {
    await withE2eDb(async db => {
      await db.collection('messages').deleteMany({ userTo: recipientDoc._id });
      await db.collection('threads').deleteMany({
        $or: [{ userFrom: recipientDoc._id }, { userTo: recipientDoc._id }],
      });
      if (offerId) await db.collection('offers').deleteOne({ _id: offerId });
      await db.collection('users').deleteOne({ _id: recipientDoc._id });
      await db.collection('users').deleteOne({ _id: senderDoc._id });
    });
  }
});
