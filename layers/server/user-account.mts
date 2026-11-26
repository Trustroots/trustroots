import contacts, {
  removePendingBetweenUsers,
} from '../../modules/contacts/server/controllers/contacts.server.controller.mts';
import { readWrittenExperiences } from '../../modules/experiences/server/services/member-experiences.server.service.mts';
import { findSearchConnectionIds } from '../../modules/experiences/server/services/search-connections.server.service.mts';
import offers from '../../modules/offers/server/controllers/offers.server.controller.mts';
import { readOwnedOffers } from '../../modules/offers/server/services/member-offers.server.service.mts';
import tribes from '../../modules/tribes/server/controllers/tribes.server.controller.mts';
import type { UserAccountServices } from '../../modules/users/server/services/user-account.server.contract.mts';
import type { RemovePendingContacts } from '../../modules/users/server/services/user-contacts.server.contract.mts';
import { userMessaging } from './user-messaging.mts';

export const userAccountServices = {
  ...userMessaging,
  updateCircleCount: (id, difference, returnUpdated, callback) =>
    tribes.updateCount(id, difference, returnUpdated, callback),
  loadExportContacts: (req, res, next, userId) =>
    contacts.contactListByUser(req, res, next, userId),
  removeAllContacts: (userId, callback) =>
    contacts.removeAllByUserId(userId, callback),
  readOwnedOffers,
  removeOwnedOffers: (userId, callback) =>
    offers.removeAllByUserId(userId, callback),
  findSearchConnectionIds,
  readWrittenExperiences,
} satisfies UserAccountServices;

export const removePendingContacts =
  removePendingBetweenUsers satisfies RemovePendingContacts;
