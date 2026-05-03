const request = require('supertest');
const { app, mongoose, dbReady } = require('../../server/index');
const User = mongoose.model('User');

describe('Story API Endpoints', () => {
  let userToken;
  let testUserId;

  beforeAll(async () => {
    await dbReady;
    await User.deleteOne({ email: 'story@test.com' });
    await User.deleteOne({ username: 'storyteller' });

    const userRes = await request(app).post('/api/auth/register').send({
      username: 'storyteller',
      email: 'story@test.com',
      password: 'Password123!',
      gender: 'female',
    });
    userToken = userRes.body.token;
    testUserId = userRes.body.user?._id;
  }, 65000);

  afterAll(async () => {
    await User.deleteOne({ email: 'story@test.com' });
  });

  it('should create a new story', async () => {
    const res = await request(app)
      .post('/api/stories/add')               // correct route: /add not /
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        mediaUrl: 'https://example.com/test-story.jpg',
        mediaType: 'image',                   // required enum: image|video|text
        textContent: 'Having a great day!',
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('_id');
  });

  it('should fetch the story feed', async () => {
    const res = await request(app)
      .get('/api/stories/feed')               // correct route: /feed not /active
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
  });
});