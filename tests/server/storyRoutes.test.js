const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server/index'); 
const Story = require('../../server/models/Story'); //

describe('Story API Endpoints', () => {
  let userToken;

  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    const userRes = await request(app).post('/api/auth/register').send({
      username: 'storyteller', email: 'story@test.com', password: 'Password123!'
    });
    userToken = userRes.body.token;
  });

  afterAll(async () => {
    await Story.deleteMany({});
    await mongoose.connection.close();
  });

  it('should create a new story', async () => {
    const res = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        imageUrl: 'https://example.com/test-story.jpg',
        caption: 'Having a great day!'
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('_id');
    expect(res.body.caption).toBe('Having a great day!');
  });

  it('should fetch active stories for a user', async () => {
    const res = await request(app)
      .get('/api/stories/active')
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
  });
});