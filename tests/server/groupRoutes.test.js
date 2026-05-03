const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server/index');
const GroupModel = require('../../server/models/GroupModel'); //

describe('Group API Endpoints', () => {
  let userToken;
  let userTwoId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    const userRes = await request(app).post('/api/auth/register').send({
      username: 'grouptester', email: 'group@test.com', password: 'Password123!'
    });
    userToken = userRes.body.token;
  });

  afterAll(async () => {
    await GroupModel.deleteMany({});
    await mongoose.connection.close();
  });

  it('should create a new group successfully', async () => {
    const res = await request(app)
      .post('/api/groups/create')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Study Group',
        members: [userTwoId], // Creating a group with the current user and userTwo
        description: 'A place to study'
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('_id');
    expect(res.body.name).toBe('Study Group');
    expect(res.body.members.length).toBe(2); // Should automatically include the creator
  });
});