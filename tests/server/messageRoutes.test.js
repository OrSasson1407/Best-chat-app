const request = require('supertest');
const { app, mongoose, dbReady } = require('../../server/index');
const Message = mongoose.model('Message');
const User = mongoose.model('User');

describe('Message API Endpoints', () => {
  let userToken;
  let testUserId;
  let testUser2Id;

  beforeAll(async () => {
    await dbReady;
    await User.deleteOne({ email: 'msg@test.com' });
    await User.deleteOne({ email: 'msg2@test.com' });

    // Register sender
    const userRes = await request(app).post('/api/auth/register').send({
      username: 'messagetester',
      email: 'msg@test.com',
      password: 'Password123!',
      gender: 'male',
    });
    userToken = userRes.body.token;
    testUserId = userRes.body.user?._id;

    // Register a second user to be the receiver ('to' field is required)
    const user2Res = await request(app).post('/api/auth/register').send({
      username: 'messagereceiver',
      email: 'msg2@test.com',
      password: 'Password123!',
      gender: 'female',
    });
    testUser2Id = user2Res.body.user?._id;
  }, 65000);

  afterAll(async () => {
    await Message.deleteMany({ sender: testUserId });
    await User.deleteOne({ email: 'msg@test.com' });
    await User.deleteOne({ email: 'msg2@test.com' });
  });

  it('should save a new message to the database', async () => {
    const res = await request(app)
      .post('/api/messages/addmsg/')           // correct route
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        from: testUserId,
        to: testUser2Id,
        message: 'Hello from the test suite!', // 'message' is a plain string, not {text}
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.msg).toBe('Message added successfully.');
  });

  it('should fetch messages for a specific chat', async () => {
    const res = await request(app)
      .post('/api/messages/getmsg/')           // correct route — GET uses POST with body
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        from: testUserId,
        to: testUser2Id,
      });

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
    expect(res.body.length).toBeGreaterThan(0);
  });
});