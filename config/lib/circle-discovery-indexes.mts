export const circleDiscoveryIndexes = [
  {
    collection: 'users',
    name: 'circle_discovery_member_seen',
    key: { 'member.tribe': 1, seen: -1, _id: 1 },
  },
  {
    collection: 'experiences',
    name: 'circle_discovery_recommenders',
    key: { userTo: 1, public: 1, recommend: 1, created: -1 },
  },
] as const;
