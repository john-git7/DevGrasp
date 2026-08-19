const request = require('supertest');
const app = require('../index');

describe('Chat Endpoints', () => {
  let token;

  beforeEach(async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'chat-tester@test.com', password: 'pw', name: 'Chat Tester' });
    token = regRes.body.token;
  });

  describe('POST /api/chat', () => {
    it('should reject access without token', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ message: 'Hello', repoUrl: 'test/repo' });
        
      expect(res.statusCode).toBe(401);
    });
  });
});
