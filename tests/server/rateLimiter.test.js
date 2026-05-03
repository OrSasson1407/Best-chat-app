const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server/index'); 

describe('Security: Auth Rate Limiting', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('should block excessive login attempts from the same IP (Brute Force Protection)', async () => {
    const loginAttempt = () => request(app).post('/api/auth/login').send({
      email: 'target@example.com',
      password: 'wrongpassword'
    });

    // Fire off 10 requests simultaneously (assuming limit is set to 5 or similar)
    const attempts = Array.from({ length: 10 }, loginAttempt);
    const results = await Promise.all(attempts);

    // Filter results to find how many succeeded (even with 401 Unauthorized) vs how many were blocked (429 Too Many Requests)
    const tooManyRequests = results.filter(res => res.statusCode === 429);
    const normalFailures = results.filter(res => res.statusCode === 401 || res.statusCode === 400);

    // We expect the rate limiter to have kicked in and blocked the later requests
    expect(tooManyRequests.length).toBeGreaterThan(0);
    expect(tooManyRequests[0].body.message).toMatch(/too many requests/i);
    expect(normalFailures.length).toBeGreaterThan(0);
  });
});