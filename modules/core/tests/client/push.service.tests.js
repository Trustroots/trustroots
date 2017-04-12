/**
 * Push service
 */
(function () {
  'use strict';

  describe('Push Service Tests', function () {

    window.FCM_SENDER_ID = 'foo';

    // Load the main application module
    beforeEach(module(AppConfig.appModuleName));

    it('should exist', inject(function(push) {
      expect(push).toBeTruthy();
    }));

  });

}());
