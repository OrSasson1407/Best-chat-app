const request = require('supertest');
const { app, dbReady } = require('../../server/index');

describe('Security: Auth Rate Limiting', () => {
  beforeAll(async () => {
    await dbReady;
  }, 65000);

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  it('should block excessive login attempts from the same IP (Brute Force Protection)', async () => {
    const loginAttempt = () =>
      request(app).post('/api/auth/login').send({
        username: 'target_user',   // login uses 'username' not 'email'
        password: 'wrongpassword',
      });

    // Rate limit max is 10 per window — send 15 to guarantee some hit 429
    const attempts = Array.from({ length: 15 }, loginAttempt);
    const results = await Promise.all(attempts);

    const tooManyRequests = results.filter((res) => res.statusCode === 429);
    const normalFailures = results.filter(
      (res) => res.statusCode === 200 || res.statusCode === 400
    );

    expect(tooManyRequests.length).toBeGreaterThan(0);
    // Rate limiter message: "Too many requests, please try again later."
    expect(tooManyRequests[0].body.message).toMatch(/too many requests/i);
    expect(normalFailures.length).toBeGreaterThan(0);
  }, 15000);
});