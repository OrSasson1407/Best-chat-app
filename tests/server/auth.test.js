const request = require('supertest');
const { app, mongoose, dbReady } = require('../../server/index');
const User = mongoose.model('User');

describe('Auth API Endpoints', () => {
  beforeAll(async () => {
    await dbReady;
    await User.deleteOne({ email: 'test@example.com' });
    await User.deleteOne({ username: 'testuser' });
  }, 65000);

  afterAll(async () => {
    await User.deleteOne({ email: 'test@example.com' });
  });

  it('should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
        gender: 'male',
      });

    // Register returns 200 with { status: true, user, token, refreshToken }
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toBe(true);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('username', 'testuser');
  });

  it('should login an existing user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        // Login requires 'username', not 'email'
        username: 'testuser',
        password: 'Password123!',
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toBe(true);
    expect(res.body).toHaveProperty('token');
  });
});