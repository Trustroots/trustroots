import {
  NOT_FOUND_ROUTE_POLICY,
  setReactRoutePolicies,
} from '../../../modules/core/shared/react-route-ownership.mts';
import { ADMIN_ROUTE_POLICIES } from '../../../modules/admin/shared/routes.mts';
import { CONTACTS_ROUTE_POLICIES } from '../../../modules/contacts/shared/routes.mts';
import { EXPERIENCES_ROUTE_POLICIES } from '../../../modules/experiences/shared/routes.mts';
import { MESSAGES_ROUTE_POLICIES } from '../../../modules/messages/shared/routes.mts';
import { OFFERS_ROUTE_POLICIES } from '../../../modules/offers/shared/routes.mts';
import { PAGES_ROUTE_POLICIES } from '../../../modules/pages/shared/routes.mts';
import { SEARCH_ROUTE_POLICIES } from '../../../modules/search/shared/routes.mts';
import { STATISTICS_ROUTE_POLICIES } from '../../../modules/statistics/shared/routes.mts';
import { SUPPORT_ROUTE_POLICIES } from '../../../modules/support/shared/routes.mts';
import { TRIBES_ROUTE_POLICIES } from '../../../modules/tribes/shared/routes.mts';
import { USERS_ROUTE_POLICIES } from '../../../modules/users/shared/routes.mts';

// Importing this module registers every route policy with the core matcher.
export const REACT_ROUTE_POLICIES = [
  ...PAGES_ROUTE_POLICIES,
  ...SUPPORT_ROUTE_POLICIES,
  ...STATISTICS_ROUTE_POLICIES,
  NOT_FOUND_ROUTE_POLICY,
  ...USERS_ROUTE_POLICIES,
  ...TRIBES_ROUTE_POLICIES,
  ...MESSAGES_ROUTE_POLICIES,
  ...SEARCH_ROUTE_POLICIES,
  ...EXPERIENCES_ROUTE_POLICIES,
  ...CONTACTS_ROUTE_POLICIES,
  ...OFFERS_ROUTE_POLICIES,
  ...ADMIN_ROUTE_POLICIES,
];
setReactRoutePolicies(REACT_ROUTE_POLICIES);
