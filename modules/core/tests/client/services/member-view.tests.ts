import { viewNavigation } from '../../../client/services/member-view';

describe('member-view document transitions', () => {
  it('broadcasts transitions before requesting a complete document navigation', () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    const storage = jest.spyOn(Storage.prototype, 'setItem');
    try {
      viewNavigation.transition('/profile/examplemember');
      expect(storage).toHaveBeenCalledWith(
        'trustroots-view-change',
        expect.any(String),
      );
      viewNavigation.reload();
    } finally {
      storage.mockRestore();
      errors.mockRestore();
    }
  });
});
