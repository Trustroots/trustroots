const client = {
  interceptors: {
    request: { use: jest.fn() },
  },
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
};

client.create = jest.fn(() => client);

module.exports = client;
