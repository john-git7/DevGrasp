const request = require('supertest');
const app = require('../index');

describe('Health Check Endpoint', () => {
  it('should return 200 OK and health status', async () => {
    const res = await request(app).get('/api/health');
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('db', 'connected');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('node');
  });
});
