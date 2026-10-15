export const E2E_PASSWORD = 'Tester123';

export const MEMBERS = [
  {
    id: '665000000000000000000001',
    username: 'e2e-seeded-berlin',
    email: 'e2e-seeded-berlin@example.test',
    firstName: 'Berlin',
    lastName: 'Host',
    location: [52.48556355813466, 13.489011526107788],
    tribes: ['Hitchhikers', 'Cyclists'],
  },
  {
    id: '665000000000000000000002',
    username: 'e2e-seeded-portland',
    email: 'e2e-seeded-portland@example.test',
    firstName: 'Portland',
    lastName: 'Host',
    location: [40.514402, -88.990735],
    tribes: ['Musicians', 'Artists'],
  },
  {
    id: '665000000000000000000003',
    username: 'e2e-seeded-beijing',
    email: 'e2e-seeded-beijing@example.test',
    firstName: 'Beijing',
    lastName: 'Host',
    location: [34.632532, 103.767519],
    tribes: ['Remote workers', 'Hikers'],
  },
  {
    id: '665000000000000000000004',
    username: 'e2e-seeded-shadow',
    email: 'e2e-seeded-shadow@example.test',
    emailTemporary: 'seeded-alice@example.test',
    firstName: 'Shadow',
    lastName: 'Spammer',
    acquisitionStory: 'I found Trustroots through hitchhiking friends online.',
    roles: ['user', 'shadowban'],
    tribes: [],
  },
  {
    id: '665000000000000000000005',
    username: 'e2e-seeded-admin',
    email: 'e2e-seeded-admin@example.test',
    firstName: 'E2E',
    lastName: 'Admin',
    roles: ['user', 'admin'],
    tribes: [],
  },
  {
    id: '665000000000000000000006',
    username: 'e2e-seeded-alice',
    email: 'e2e-seeded-alice@example.test',
    firstName: 'Alice',
    lastName: 'Contact',
    acquisitionStory: 'I found Trustroots through hitchhiking friends online.',
    location: [52.37, 4.9],
    locationFrom: 'Fictional origin',
    locationLiving: 'Fictional home',
    tribes: ['Families'],
  },
  {
    id: '665000000000000000000007',
    username: 'e2e-seeded-bob',
    email: 'e2e-seeded-bob@example.test',
    firstName: 'Bob',
    lastName: 'Blocked',
    tribes: ['Climbers'],
  },
];

export const CONVERSATIONS = [
  {
    key: 'berlin-portland',
    messages: [
      {
        from: 'e2e-seeded-portland',
        to: 'e2e-seeded-berlin',
        content: 'Hi Berlin host, are you available next week?',
        read: true,
      },
      {
        from: 'e2e-seeded-berlin',
        to: 'e2e-seeded-portland',
        content: 'Yes, happy to host you!',
        read: false,
      },
    ],
  },
];

export const SHADOW_MESSAGES = [
  {
    from: 'e2e-seeded-shadow',
    to: 'e2e-seeded-berlin',
    content: 'Hidden outreach from shadowbanned member',
  },
];
