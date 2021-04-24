import AppConfig from '@/modules/core/client/app/config';

import '@/modules/core/client/core.client.module';

AppConfig.registerModule('offers', ['core']);

// config
require('@/modules/offers/client/config/offers.client.routes');

// controllers
require('@/modules/offers/client/controllers/offer-host-edit.client.controller');
require('@/modules/offers/client/controllers/offer-host-view.client.controller');
require('@/modules/offers/client/controllers/offer-meet-add.client.controller');
require('@/modules/offers/client/controllers/offer-meet-edit.client.controller');
require('@/modules/offers/client/controllers/offer-meet-list.client.controller');
require('@/modules/offers/client/controllers/offer.client.controller');

// directives
require('@/modules/offers/client/directives/tr-offer-valid-until.client.directive');

// services
require('@/modules/offers/client/services/offers-by.client.service');
require('@/modules/offers/client/services/offers.client.service');
