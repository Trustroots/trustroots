import {
  cancelAdminPassword,
  isAdminElevationPending,
  requestAdminPassword,
  submitAdminPassword,
} from '@/modules/admin/client/api/admin-elevation';

describe('admin elevation api helper', () => {
  afterEach(() => {
    cancelAdminPassword();
  });

  it('resolves a pending password prompt', async () => {
    const pending = requestAdminPassword();
    expect(isAdminElevationPending()).toBe(true);
    submitAdminPassword('ExamplePassword123!');
    await expect(pending).resolves.toBe('ExamplePassword123!');
    expect(isAdminElevationPending()).toBe(false);
  });

  it('rejects when the password prompt is cancelled', async () => {
    const pending = requestAdminPassword();
    cancelAdminPassword();
    await expect(pending).rejects.toThrow('Admin confirmation cancelled.');
  });
});
