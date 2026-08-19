const request = require('supertest');
const app = require('../index');

describe('Repos Endpoints', () => {
  let token;

  beforeEach(async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'repo-tester@test.com', password: 'pw', name: 'Repo Tester' });
    token = regRes.body.token;
  });

  describe('Unauthenticated Access', () => {
    it('should reject access without token', async () => {
      const res = await request(app).get('/api/repos/indexed');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/repos/indexed', () => {
    it('should return empty array initially', async () => {
      const res = await request(app)
        .get('/api/repos/indexed')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });
  });

  describe('POST /api/repos/index', () => {
    it('should fail if url is missing', async () => {
      const res = await request(app)
        .post('/api/repos/index')
        .set('Authorization', `Bearer ${token}`)
        .send({}); // Missing url
      
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});
