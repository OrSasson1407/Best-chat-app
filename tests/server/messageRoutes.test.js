const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server/index'); 
const Message = require('../../server/models/Message'); //
const User = require('../../server/models/User'); //

describe('Message API Endpoints', () => {
  let userToken;
  let testUserId;
  let testChatId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    // Create a test user and get a token (assuming your auth route returns one)
    const userRes = await request(app).post('/api/auth/register').send({
      username: 'messagetester', email: 'msg@test.com', password: 'Password123!'
    });
    userToken = userRes.body.token;
    testUserId = userRes.body.user._id;
  });

  afterAll(async () => {
    await Message.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  it('should save a new message to the database', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        chatId: testChatId,
        text: 'Hello from the test suite!'
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body.text).toBe('Hello from the test suite!');
    expect(res.body.sender.toString()).toBe(testUserId);
  });

  it('should fetch messages for a specific chat', async () => {
    const res = await request(app)
      .get(`/api/messages/${testChatId}`)
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].text).toBe('Hello from the test suite!');
  });
});