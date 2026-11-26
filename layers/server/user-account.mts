import offers from '../../modules/offers/server/controllers/offers.server.controller.mts';
import { readOwnedOffers } from '../../modules/offers/server/services/member-offers.server.service.mts';
import type { UserAccountServices } from '../../modules/users/server/services/user-account.server.contract.mts';
import { userMessaging } from './user-messaging.mts';

export const userAccountServices = {
  ...userMessaging,
  readOwnedOffers,
  removeOwnedOffers: (userId, callback) =>
    offers.removeAllByUserId(userId, callback),
} satisfies UserAccountServices;
