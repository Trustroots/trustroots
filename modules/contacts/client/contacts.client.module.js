import AppConfig from '@/modules/core/client/app/config';

import '@/modules/core/client/core.client.module';

AppConfig.registerModule('contacts', ['core']);

// config
require('@/modules/contacts/client/config/contacts.client.routes');

// controllers
require('@/modules/contacts/client/controllers/add-contact.client.controller');
require('@/modules/contacts/client/controllers/confirm-contact.client.controller');
require('@/modules/contacts/client/controllers/list-contacts.client.controller');
require('@/modules/contacts/client/controllers/remove-contact.client.controller');

// directives
require('@/modules/contacts/client/directives/tr-contact-remove.client.directive');
require('@/modules/contacts/client/directives/tr-contact.client.directive');

// services
require('@/modules/contacts/client/services/contact-by.client.service');
require('@/modules/contacts/client/services/contact.client.service');
require('@/modules/contacts/client/services/contacts-list.client.service');
