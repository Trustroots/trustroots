import AppConfig from '@/modules/core/client/app/config';

AppConfig.registerModule('core');

// config
require('@/modules/core/client/config/core.client.config');
require('@/modules/core/client/config/core.client.routes');
require('@/modules/core/client/config/core.client.run');

// controllers
require('@/modules/core/client/controllers/app.client.controller');

// directives
require('@/modules/core/client/directives/message-center.client.directive');
require('@/modules/core/client/directives/tr-board-credits.client.directive');
require('@/modules/core/client/directives/tr-boards.client.directive');
require('@/modules/core/client/directives/tr-date-select.client.directive');
require('@/modules/core/client/directives/tr-editor.client.directive');
require('@/modules/core/client/directives/tr-flashcards.client.directive');
require('@/modules/core/client/directives/tr-focustip.client.directive');
require('@/modules/core/client/directives/tr-highlight-on-focus.client.directive');
require('@/modules/core/client/directives/tr-languages.client.directive');
require('@/modules/core/client/directives/tr-location.client.directive');
require('@/modules/core/client/directives/tr-page-title.client.directive');
require('@/modules/core/client/directives/tr-placeholder.client.directive');
require('@/modules/core/client/directives/tr-share-fb.client.directive');
require('@/modules/core/client/directives/tr-share-twitter.client.directive');
require('@/modules/core/client/directives/tr-spinner.client.directive');
require('@/modules/core/client/directives/tr-switch.client.directive');
require('@/modules/core/client/directives/tr-time.client.directive');

// filters
require('@/modules/core/client/filters/age.client.filter');
require('@/modules/core/client/filters/plain-text-length.client.filter');
require('@/modules/core/client/filters/trusted-html.client.filter');

// services
require('@/modules/core/client/services/facebook.client.service');
require('@/modules/core/client/services/firebase-messaging.client.service');
require('@/modules/core/client/services/languages.client.service');
require('@/modules/core/client/services/location.client.service');
require('@/modules/core/client/services/maplayers.client.service');
require('@/modules/core/client/services/mapmarkers.client.service');
require('@/modules/core/client/services/message-center-client.service');
require('@/modules/core/client/services/native-app-bridge.client.service');
require('@/modules/core/client/services/photos.service');
require('@/modules/core/client/services/push.client.service');
require('@/modules/core/client/services/settings.client.service');
