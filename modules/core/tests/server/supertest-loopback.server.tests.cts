const request: typeof import('supertest') = require('supertest');
require('should');

describe('Supertest request servers', () => {
  const app: import('node:http').RequestListener = (req, res) => {
    res.end(req.socket.localAddress);
  };

  it('listen on the loopback address that requests are sent to', async () => {
    const { text } = await request(app).get('/').expect(200);
    text.should.equal('127.0.0.1');
  });

  it('serve concurrent agent requests from one server', async () => {
    const agent = request.agent(app);
    const responses = await Promise.all([agent.get('/'), agent.get('/')]);
    responses
      .map(response => response.text)
      .should.deepEqual(['127.0.0.1', '127.0.0.1']);
  });
});
