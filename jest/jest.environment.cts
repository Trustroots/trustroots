const { TestEnvironment } =
  require('jest-environment-jsdom') as typeof import('jest-environment-jsdom');

// TanStack Router throws redirects as fetch Responses, which jsdom lacks.
module.exports = class RouterTestEnvironment extends TestEnvironment {
  constructor(...args: ConstructorParameters<typeof TestEnvironment>) {
    super(...args);
    Object.assign(this.global, { Headers, Response });
  }
};
