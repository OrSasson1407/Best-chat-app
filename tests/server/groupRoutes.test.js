const request = require('supertest');
const { app, mongoose, dbReady } = require('../../server/index');
const GroupModel = mongoose.model('Group');
const User = mongoose.model('User');

describe('Group API Endpoints', () => {
  let userToken;
  let testUserId;
  const userTwoId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await dbReady;
    await User.deleteOne({ email: 'group@test.com' });
    await User.deleteOne({ username: 'grouptester' });

    const userRes = await request(app).post('/api/auth/register').send({
      username: 'grouptester',
      email: 'group@test.com',
      password: 'Password123!',
      gender: 'male',
    });
    userToken = userRes.body.token;
    testUserId = userRes.body.user?._id;
  }, 65000);

  afterAll(async () => {
    await GroupModel.deleteMany({ name: 'Study Group' });
    await User.deleteOne({ email: 'group@test.com' });
  });

  it('should create a new group successfully', async () => {
    const res = await request(app)
      .post('/api/groups/create')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Study Group',
        members: [userTwoId],
        description: 'A place to study',
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('_id');
    expect(res.body.name).toBe('Study Group');
    expect(res.body.members.length).toBe(2);
  });
});