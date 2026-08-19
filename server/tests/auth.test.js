const request = require('supertest');
const app = require('../index');

describe('Auth Endpoints', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User'
  };

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', testUser.email);
    });

    it('should fail if email is already taken', async () => {
      await request(app).post('/api/auth/register').send(testUser); // Register first
      
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser); // Try again
      
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'User already exists');
    });

    it('should fail if fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'incomplete@example.com' });
      
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'All fields are required');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(testUser);
    });

    it('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
    });

    it('should fail with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' });
      
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user info if authorized', async () => {
      // 1. Register
      const regRes = await request(app).post('/api/auth/register').send(testUser);
      const token = regRes.body.token;

      // 2. Fetch /me
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.user).toHaveProperty('email', testUser.email);
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request(app).get('/api/auth/me');
      
      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });
});
