import axios from 'axios';
import { forgotPassword } from '@/modules/users/client/api/recovery.api';
jest.mock('axios');
it('submits recovery details to the existing endpoint', async () => {
  const credentials = { username: 'samplemember' };
  axios.post.mockResolvedValue({ data: { message: 'Sent' } });
  await expect(forgotPassword(credentials)).resolves.toEqual({
    message: 'Sent',
  });
  expect(axios.post).toHaveBeenCalledWith('/api/auth/forgot', credentials);
});
