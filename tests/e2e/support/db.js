const { MongoClient, ObjectId } = require('mongodb');

const mongoHost = process.env.DB_1_PORT_27017_TCP_ADDR || '127.0.0.1';
const mongoUri =
  process.env.TRUSTROOTS_E2E_MONGO_URI ||
  `mongodb://${mongoHost}:27017/trustroots-test`;

async function withE2eDb(callback) {
  const client = await MongoClient.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    return await callback(client.db());
  } finally {
    await client.close();
  }
}

function objectId(id) {
  return typeof id === 'string' ? new ObjectId(id) : id;
}

async function findUserByUsername(username) {
  return withE2eDb(db => db.collection('users').findOne({ username }));
}

async function findContactByUsers(userFrom, userTo) {
  return withE2eDb(db =>
    db.collection('contacts').findOne({
      $or: [
        { userFrom: objectId(userFrom), userTo: objectId(userTo) },
        { userFrom: objectId(userTo), userTo: objectId(userFrom) },
      ],
    }),
  );
}

async function findOffersByUser(userId, query = {}) {
  return withE2eDb(db =>
    db
      .collection('offers')
      .find({ user: objectId(userId), ...query })
      .sort({ updated: -1, createdAt: -1 })
      .toArray(),
  );
}

async function updateUserByUsername(username, update) {
  return withE2eDb(db =>
    db.collection('users').updateOne({ username }, update),
  );
}

async function removeUserByUsername(username) {
  return withE2eDb(db => db.collection('users').deleteOne({ username }));
}

async function removeExperiencesBetweenUsernames(usernameFrom, usernameTo) {
  return withE2eDb(async db => {
    const [userFrom, userTo] = await Promise.all([
      db.collection('users').findOne({ username: usernameFrom }),
      db.collection('users').findOne({ username: usernameTo }),
    ]);

    if (!userFrom?._id || !userTo?._id) {
      return { deletedCount: 0 };
    }

    return db.collection('experiences').deleteMany({
      $or: [
        { userFrom: userFrom._id, userTo: userTo._id },
        { userFrom: userTo._id, userTo: userFrom._id },
      ],
    });
  });
}

module.exports = {
  findContactByUsers,
  findOffersByUser,
  findUserByUsername,
  objectId,
  removeExperiencesBetweenUsernames,
  removeUserByUsername,
  updateUserByUsername,
  withE2eDb,
};
