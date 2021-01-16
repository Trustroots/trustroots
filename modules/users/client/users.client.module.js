import AppConfig from '@/modules/core/client/app/config';

import '@/modules/core/client/core.client.module';

AppConfig.registerModule('users', ['core']);

// config
require('@/modules/users/client/config/users.client.config');
require('@/modules/users/client/config/users.client.routes');

// controllers
require('@/modules/users/client/controllers/authentication.client.controller');
require('@/modules/users/client/controllers/avatar-editor.client.controller');
require('@/modules/users/client/controllers/confirm-email.client.controller');
require('@/modules/users/client/controllers/password-forgot.client.controller');
require('@/modules/users/client/controllers/password-reset.client.controller');
require('@/modules/users/client/controllers/profile-edit-about.client.controller');
require('@/modules/users/client/controllers/profile-edit-account.client.controller');
require('@/modules/users/client/controllers/profile-edit-locations.client.controller');
require('@/modules/users/client/controllers/profile-edit-networks.client.controller');
require('@/modules/users/client/controllers/profile-edit-photo.client.controller');
require('@/modules/users/client/controllers/profile-edit-tribes.client.controller');
require('@/modules/users/client/controllers/profile-edit.client.controller');
require('@/modules/users/client/controllers/profile.client.controller');
require('@/modules/users/client/controllers/remove.client.controller');
require('@/modules/users/client/controllers/signup.client.controller');

// directives
require('@/modules/users/client/directives/tr-avatar.client.directive');
require('@/modules/users/client/directives/tr-confirm-password.client.directive');
require('@/modules/users/client/directives/tr-memberships-list.client.directive');
require('@/modules/users/client/directives/tr-monkeybox.client.directive');
require('@/modules/users/client/directives/tr-validate-username.client.directive');

// services
require('@/modules/users/client/services/authentication.client.service');
require('@/modules/users/client/services/signup-validation.client.service');
require('@/modules/users/client/services/users-memberships.client.service');
require('@/modules/users/client/services/users-mini.client.service');
require('@/modules/users/client/services/users-profile.client.service');
require('@/modules/users/client/services/users.client.service');
